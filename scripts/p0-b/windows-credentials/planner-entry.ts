import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CodexLaunchProjection } from './codex-launch-projection.mjs'
import { projectCodexLaunch } from './codex-launch-projection.mjs'
import type { RedactionLimits } from '../redaction.ts'
import {
  invokePlannerOnce,
  PlannerInvocationError,
  type PlannerApproval,
  type PlannerInvocationResult,
} from './planner-invocation.ts'
import type { SealedBridge } from './reader.ts'
import { createProcessJobOwner, ProcessJobOwnerError, type ProcessJobOwner, type ProcessJobOwnerSpec } from './windows-job-owner.ts'

/**
 * Everything the trusted caller must decide before one projected invocation.
 * A non-empty approval or transport record name is a reference, not proof the
 * record exists; the entry fails closed on every mismatch it can check.
 */
export interface ProjectedPlannerEntrySpec {
  configuration: unknown
  trustedLock: unknown
  input: {
    platform: 'win32' | 'linux' | 'darwin'
    workspace: string
    runRoot: string
    executable: string
    executableSha256: string
    systemRoot: string | null
    toolDirectories: string[]
  }
  approval: PlannerApproval
  prompt: { file: string; sha256: string }
  bridge: SealedBridge
  bounds: {
    deadlineMs: number
    terminationGraceMs: number
    maxChannelBytes: number
    redactionLimits: RedactionLimits
  }
  jobOwner: ProcessJobOwnerSpec
}

/** Containment facts from the owned job; `terminated` false never means success. */
export interface ProjectedPlannerOwnershipReceipt {
  assignmentRequested: boolean
  terminated: boolean
  activeProcessesRemaining: number
  disposed: boolean
}

export type ProjectedPlannerEntryResult =
  | { status: 'PROJECTED_PLANNER_REFUSED'; code: string; productAccepted: false }
  | {
    status: 'PROJECTED_PLANNER_COMPLETED' | 'PROJECTED_PLANNER_CANCELLED'
    invocation: PlannerInvocationResult
    ownership: ProjectedPlannerOwnershipReceipt
    publicConfigSha256: string
    productAccepted: false
  }

/**
 * Minimal actual caller entry: project the approved route, materialize the
 * isolated run tree, take an owned job, and run exactly one planner invocation
 * whose argv, environment and CODEX_HOME all come from the projection.
 * @param spec - trusted-caller decisions; synthetic authorization validates the
 *   wiring, real authorization stays an owner action this entry cannot issue.
 * @returns a refused result or one invocation plus its ownership receipt.
 */
export async function invokeProjectedPlannerOnce(spec: ProjectedPlannerEntrySpec): Promise<ProjectedPlannerEntryResult> {
  let projection: CodexLaunchProjection
  try {
    projection = projectCodexLaunch(spec.configuration, spec.trustedLock, spec.input)
  } catch {
    return { status: 'PROJECTED_PLANNER_REFUSED', code: 'CODEX_LAUNCH_PROJECTION_REFUSED', productAccepted: false }
  }
  if (spec.approval.subject.model !== projection.route.model
    || spec.approval.subject.reasoningEffort !== projection.route.reasoningEffort
    || spec.approval.subject.baseUrl !== projection.route.baseUrl) {
    return { status: 'PROJECTED_PLANNER_REFUSED', code: 'PLANNER_SUBJECT_NOT_APPROVED', productAccepted: false }
  }
  if (process.platform !== 'win32') {
    return { status: 'PROJECTED_PLANNER_REFUSED', code: 'PROJECTED_PLANNER_WINDOWS_OWNER_REQUIRED', productAccepted: false }
  }
  // Caller-owned materialization: the projection deliberately writes nothing.
  const runDirectories = ['home', 'codex-home', 'tmp', 'config', 'cache', 'data', 'state']
  try {
    for (const directory of runDirectories) await mkdir(join(projection.runRoot, directory), { recursive: true })
    await writeFile(projection.configFile, projection.configToml, { flag: 'wx' })
  } catch {
    return { status: 'PROJECTED_PLANNER_REFUSED', code: 'PROJECTED_PLANNER_RUNROOT_UNAVAILABLE', productAccepted: false }
  }
  const ownerAttempt = await createProcessJobOwner(spec.jobOwner)
    .then(owner => ({ ok: true as const, owner }))
    .catch((error: unknown) => ({ ok: false as const, error }))
  if (!ownerAttempt.ok) {
    const code = ownerAttempt.error instanceof ProcessJobOwnerError ? ownerAttempt.error.code : 'OWNER_HELPER_INVALID'
    return { status: 'PROJECTED_PLANNER_REFUSED', code, productAccepted: false }
  }
  const owner: ProcessJobOwner = ownerAttempt.owner
  const receipt: ProjectedPlannerOwnershipReceipt = {
    assignmentRequested: false, terminated: false, activeProcessesRemaining: -1, disposed: false,
  }
  try {
    const result = await invokePlannerOnce({
      approval: spec.approval,
      route: projection.route,
      prompt: spec.prompt,
      cli: { executable: projection.executable, sha256: projection.executableSha256, args: projection.args },
      bridge: spec.bridge,
      process: {
        workingDirectory: projection.workingDirectory,
        environment: projection.environment,
        credentialEnvironmentVariable: projection.credentialEnvironmentVariable,
        deadlineMs: spec.bounds.deadlineMs,
        terminationGraceMs: spec.bounds.terminationGraceMs,
        maxChannelBytes: spec.bounds.maxChannelBytes,
        ownership: owner,
      },
      redactionLimits: spec.bounds.redactionLimits,
    })
    receipt.assignmentRequested = result.ownership?.assignmentRequested ?? false
    // Terminate survivors of both completion and cancellation, then count what
    // the owned job still holds; only the owner can certify its own scope.
    receipt.terminated = await owner.terminateOwned()
    receipt.activeProcessesRemaining = await owner.activeProcesses()
    return {
      status: result.status === 'PLANNER_INVOCATION_COMPLETED' ? 'PROJECTED_PLANNER_COMPLETED' : 'PROJECTED_PLANNER_CANCELLED',
      invocation: result,
      ownership: receipt,
      publicConfigSha256: projection.publicConfigSha256,
      productAccepted: false,
    }
  } catch (error) {
    const code = error instanceof PlannerInvocationError ? error.code : 'PLANNER_INVOCATION_FAILED'
    return { status: 'PROJECTED_PLANNER_REFUSED', code, productAccepted: false }
  } finally {
    try {
      await owner.dispose()
      receipt.disposed = true
    } catch { /* disposal failure cannot restore the tree; receipt stays false */ }
  }
}
