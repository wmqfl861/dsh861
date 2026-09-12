import type { PreparedPlannerRun } from './owner-approved-planner.ts'
import type { CodexLaunchProjection } from './codex-launch-projection.mjs'

/** Local Git preparation policy; parent directories and Git installation must be protected. */
export interface PlannerSnapshotPolicy {
  gitExecutable: string
  gitSha256: string
  snapshotParent: string
  gitTimeoutMs: number
  maxFiles: number
  maxFileBytes: number
  maxTotalBytes: number
}

/** Independent committed files, not operating-system access control or execution permission. */
export interface PreparedPlannerSnapshot {
  status: 'PLANNER_INPUT_PREPARED_NOT_AUTHORIZED'
  prepared: PreparedPlannerRun
  projection: CodexLaunchProjection
  directory: string
  workspace: string
  manifestSha256: string
  totalBytes: number
  executionAuthorized: false
  productAccepted: false
  /** Re-read the complete snapshot, rejecting extra, missing, linked or changed files. */
  verify(): Promise<void>
  /** Delete only the allocation owned by this handle; changed root identity blocks cleanup. */
  dispose(): Promise<void>
}

/** Fixed error identifiers; raw Git diagnostics and file bytes are not attached. */
export class PlannerSnapshotError extends Error { readonly code: string; constructor(code: string) }

/**
 * Export admitted raw Git blobs and rebind the existing unsigned planner request to the snapshot.
 * @param input - fixed SHA-1 commit, file hashes and existing non-secret planning inputs.
 * @param policy - verified Git executable and local preparation limits.
 * @returns owned snapshot; callers sign prepared only after protecting and verifying it.
 */
export function preparePlannerInputSnapshot(input: PreparedPlannerRun, policy: PlannerSnapshotPolicy): Promise<PreparedPlannerSnapshot>
