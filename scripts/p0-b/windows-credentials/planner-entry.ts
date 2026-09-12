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
  type PlannerProcessOwnership,
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
    /** Explicit non-Git input snapshot; this does not relax the read-only sandbox. */
    workspaceKind?: 'fixed-input-snapshot'
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
  assigned: boolean
  terminated: boolean
  activeProcessesRemaining: number
  disposed: boolean
}

export type ProjectedPlannerEntryResult =
  | { status: 'PROJECTED_PLANNER_REFUSED'; code: string; ownership?: ProjectedPlannerOwnershipReceipt; productAccepted: false }
  | {
    status: 'PROJECTED_PLANNER_COMPLETED' | 'PROJECTED_PLANNER_CANCELLED' | 'PROJECTED_PLANNER_CLEANUP_BLOCKED'
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
  spec = { ...spec,
    input: { ...spec.input, toolDirectories: [...spec.input.toolDirectories] },
    approval: { ...spec.approval, subject: { ...spec.approval.subject } },
    prompt: { ...spec.prompt },
    bounds: { ...spec.bounds, redactionLimits: { ...spec.bounds.redactionLimits } },
    jobOwner: { ...spec.jobOwner, sha256: { ...spec.jobOwner.sha256 }, environment: { ...spec.jobOwner.environment } },
  }
  if (!spec.approval.record.trim() || !spec.approval.transportEvidenceRecord.trim()) {
    return { status: 'PROJECTED_PLANNER_REFUSED', code: 'PLANNER_APPROVAL_INVALID', productAccepted: false }
  }
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
    // Reserving the root exclusively rejects reused directories and existing links.
    // Its parent and Windows ACL still have to be controlled by the trusted caller.
    await mkdir(projection.runRoot, { mode: 0o700 })
    for (const directory of runDirectories) await mkdir(join(projection.runRoot, directory), { mode: 0o700 })
    await writeFile(projection.configFile, projection.configToml, { flag: 'wx', mode: 0o600 })
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
  // The owner and invocation expose different names; this entry requires all gate operations.
  const ownership: Required<PlannerProcessOwnership> = {
    launch: request => owner.launchGated(request),
    assign: pid => owner.assign(pid),
    release: () => { owner.releaseGated() },
    abort: () => { owner.abortGated() },
    terminateOwned: () => owner.terminateOwned(),
  }
  const receipt: ProjectedPlannerOwnershipReceipt = {
    assignmentRequested: false, assigned: false, terminated: false, activeProcessesRemaining: -1, disposed: false,
  }
  let result: PlannerInvocationResult | undefined
  let refusalCode: string | undefined
  try {
    result = await invokePlannerOnce({
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
        ownership,
      },
      redactionLimits: spec.bounds.redactionLimits,
    })
    receipt.assignmentRequested = result.ownership?.assignmentRequested ?? false
    receipt.assigned = result.ownership?.assigned ?? false
  } catch (error) {
    refusalCode = error instanceof PlannerInvocationError ? error.code : 'PLANNER_INVOCATION_FAILED'
  } finally {
    // Keep all cleanup facts, including invocation failures and unknown job counts.
    try { receipt.terminated = await owner.terminateOwned() } catch { /* retained false */ }
    try { receipt.activeProcessesRemaining = await owner.activeProcesses() } catch { /* retained -1 */ }
    try { await owner.dispose(); receipt.disposed = true } catch { /* retained false; no proof of disposal */ }
  }
  if (!result) {
    return { status: 'PROJECTED_PLANNER_REFUSED', code: refusalCode ?? 'PLANNER_INVOCATION_FAILED',
      ownership: receipt, productAccepted: false }
  }
  const cleanupComplete = receipt.assigned && receipt.terminated
    && receipt.activeProcessesRemaining === 0 && receipt.disposed
  return {
    status: !cleanupComplete ? 'PROJECTED_PLANNER_CLEANUP_BLOCKED'
      : result.status === 'PLANNER_INVOCATION_COMPLETED' ? 'PROJECTED_PLANNER_COMPLETED' : 'PROJECTED_PLANNER_CANCELLED',
    invocation: result,
    ownership: receipt,
    publicConfigSha256: projection.publicConfigSha256,
    productAccepted: false,
  }
}
