/** Owner-authenticated admission for the existing projected planner; no alternate launcher. */
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { projectCodexLaunch } from './codex-launch-projection.mjs'
import { invokeProjectedPlannerOnce, type ProjectedPlannerEntryResult, type ProjectedPlannerEntrySpec } from './planner-entry.ts'
import { PlannerApprovalError, type PlannerApprovalVerifier, type PlannerOwnerDecision } from './planner-approval.mjs'
import type { SealedBridge } from './reader.ts'
import type { PlannerTlsReceipt, PlannerTlsVerifier } from './planner-tls.mjs'

/** Preparation contains public data only; credentials and authority come from the service. */
export interface PreparedPlannerRun {
  sourceCommit: string
  readSet: ReadonlyArray<{ path: string; sha256: string }>
  run: Omit<ProjectedPlannerEntrySpec, 'approval' | 'bridge'>
}

/** Admission facts bound to one request and one owner decision by a trusted control adapter. */
export interface PlannerControlLease {
  requestSha256: string
  approvalId: string
  transportRecord: string
  rotationRecord: string
  budget: { currency: string; limitMinorUnits: number; enforcementRecord: string }
  /** Evidence identifiers are audit references; the adapter must establish actual OS restrictions. */
  isolationRecord: string
  /** Recheck live authorization, protected transport, isolation and reserved cost immediately before reading. */
  assertActive(): Promise<void>
  /** Release the reservation/control resources; throws if their final state is unknown. */
  close(): Promise<void>
}

/** These are trusted service dependencies, never fields accepted from an agent or request JSON. */
export interface OwnerApprovedPlannerServices {
  approvals: PlannerApprovalVerifier
  bridge: SealedBridge
  /** Independent exact-route TLS verifier; handshake evidence does not replace live enforcement. */
  transport: PlannerTlsVerifier
  /** Must be bounded, fail closed and enforce actual controls, not accept user-supplied success strings. */
  acquireControls(claims: Readonly<PlannerOwnerDecision>, requestSha256: string): Promise<PlannerControlLease>
}

/** A local result never marks product or node acceptance. */
export type OwnerApprovedPlannerResult =
  | { status: 'OWNER_APPROVED_PLANNER_BLOCKED'; code: string; productAccepted: false }
  | {
    status: 'OWNER_APPROVED_PLANNER_ATTEMPTED' | 'OWNER_APPROVED_PLANNER_CLEANUP_BLOCKED'
    approvalId: string
    requestSha256: string
    result?: ProjectedPlannerEntryResult
    transport?: Readonly<PlannerTlsReceipt>
    productAccepted: false
  }

const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex')
const record = (value: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value)

function prepare(input: PreparedPlannerRun) {
  const prepared = structuredClone(input)
  if (!/^[a-f0-9]{40}$/.test(prepared.sourceCommit) || prepared.readSet.length < 1) {
    throw new PlannerApprovalError('PLANNER_REQUEST_INVALID')
  }
  const names = new Set<string>()
  for (const file of prepared.readSet) {
    if (!file.path || /[\\:\0\r\n]/.test(file.path) || file.path.split('/').some(part => !part || part === '.' || part === '..')
      || !/^[a-f0-9]{64}$/.test(file.sha256) || names.has(file.path.toLowerCase())) {
      throw new PlannerApprovalError('PLANNER_REQUEST_INVALID')
    }
    names.add(file.path.toLowerCase())
  }
  const projection = projectCodexLaunch(prepared.run.configuration, prepared.run.trustedLock, prepared.run.input)
  const payload = JSON.stringify({ version: 1, purpose: 'P0-B-CODEX-PLAN', sourceCommit: prepared.sourceCommit,
    readSet: prepared.readSet, projection, prompt: prepared.run.prompt, bounds: prepared.run.bounds,
    jobOwner: prepared.run.jobOwner })
  return { prepared, projection, requestSha256: hash(payload), payload }
}

/**
 * Describe exactly what a separate owner interface approves; no files, keys or processes are touched.
 * @param input - fixed public invocation and declared file hashes.
 * @returns the reviewable payload and its digest, not an execution permit.
 */
export function describePlannerApprovalRequest(input: PreparedPlannerRun): { payload: string; requestSha256: string } {
  const { payload, requestSha256 } = prepare(input)
  return { payload, requestSha256 }
}

async function checkReadSet(prepared: PreparedPlannerRun): Promise<void> {
  const root = await realpath(prepared.run.input.workspace)
  for (const file of prepared.readSet) {
    const resolved = await realpath(join(root, file.path))
    const inside = relative(root, resolved)
    if (inside === '..' || inside.startsWith('../') || inside.startsWith('..\\') || isAbsolute(inside)
      || hash(await readFile(resolved)) !== file.sha256) throw new PlannerApprovalError('PLANNER_READ_SET_CHANGED')
  }
  if (hash(await readFile(prepared.run.prompt.file)) !== prepared.run.prompt.sha256) {
    throw new PlannerApprovalError('PLANNER_INPUT_NOT_FIXED')
  }
}

function checkLease(lease: PlannerControlLease, claims: Readonly<PlannerOwnerDecision>, digest: string): void {
  if (lease.requestSha256 !== digest || lease.approvalId !== claims.approvalId
    || lease.transportRecord !== claims.transportRecord || lease.rotationRecord !== claims.rotationRecord
    || lease.budget.currency !== claims.budget.currency || lease.budget.limitMinorUnits !== claims.budget.limitMinorUnits
    || lease.budget.enforcementRecord !== claims.budget.enforcementRecord || !record(lease.isolationRecord)) {
    throw new PlannerApprovalError('PLANNER_CONTROL_BINDING_MISMATCH')
  }
}

/**
 * Bind the signed decision and live controls before one read and before releasing its completed response.
 * A consumed decision stays consumed after refusal, crash or cleanup failure; no automatic retry.
 * @param services - independent owner verifier, private reader, TLS verifier and real control adapter.
 * @returns the admission function; missing enforcement must make acquireControls reject.
 */
export function createOwnerApprovedPlanner(services: OwnerApprovedPlannerServices) {
  const { approvals, bridge } = services
  return async (input: PreparedPlannerRun, signedDecision: unknown): Promise<OwnerApprovedPlannerResult> => {
    let lease: PlannerControlLease | undefined
    let result: ProjectedPlannerEntryResult | undefined
    let transport: Readonly<PlannerTlsReceipt> | undefined
    let approvalId = ''
    let requestSha256 = ''
    let failure: string | undefined
    let cleanupFailed = false
    try {
      const envelope = structuredClone(signedDecision)
      const snapshot = prepare(input)
      requestSha256 = snapshot.requestSha256
      const claims = approvals.inspect(envelope, requestSha256)
      approvalId = claims.approvalId
      await checkReadSet(snapshot.prepared)
      // Consume before acquiring any externally backed reservation; concurrent replays cannot reserve twice.
      await approvals.consume(envelope, requestSha256)
      lease = await services.acquireControls(claims, requestSha256)
      checkLease(lease, claims, requestSha256)
      await lease.assertActive()
      const activeLease = lease
      let readAttempted = false
      const guardedBridge: SealedBridge = async (...args) => {
        if (readAttempted) throw new PlannerApprovalError('PLANNER_CREDENTIAL_READ_REPEATED')
        readAttempted = true
        approvals.inspect(envelope, requestSha256)
        checkLease(activeLease, claims, requestSha256)
        await activeLease.assertActive()
        // Only the authenticated, consumed attempt can contact its explicitly configured TLS peer.
        transport = await services.transport.verify(claims.transportRecord, snapshot.projection.route.baseUrl, requestSha256)
        // The probe is a separate connection. Recheck live enforcement and consent before the actual read.
        approvals.inspect(envelope, requestSha256)
        await activeLease.assertActive()
        // Controls can await network or OS work; neither expired consent nor changed files may pass afterward.
        approvals.inspect(envelope, requestSha256)
        await checkReadSet(snapshot.prepared)
        approvals.inspect(envelope, requestSha256)
        const response = await bridge(...args)
        // A native read is asynchronous; its completed envelope is not permission to continue.
        approvals.inspect(envelope, requestSha256)
        checkLease(activeLease, claims, requestSha256)
        await activeLease.assertActive()
        await checkReadSet(snapshot.prepared)
        approvals.inspect(envelope, requestSha256)
        checkLease(activeLease, claims, requestSha256)
        return response
      }
      result = await invokeProjectedPlannerOnce({ ...snapshot.prepared.run, bridge: guardedBridge,
        approval: { record: claims.approvalId, transportEvidenceRecord: claims.transportRecord,
          subject: { agent: 'codex', model: snapshot.projection.route.model,
            reasoningEffort: snapshot.projection.route.reasoningEffort, baseUrl: snapshot.projection.route.baseUrl } } })
    } catch (error) {
      failure = error instanceof PlannerApprovalError ? error.code : 'PLANNER_ADMISSION_OR_CONTROL_FAILED'
    } finally {
      if (lease) {
        try { await lease.close() } catch { cleanupFailed = true }
      }
    }
    if (cleanupFailed) return { status: 'OWNER_APPROVED_PLANNER_CLEANUP_BLOCKED', approvalId, requestSha256,
      ...(result ? { result } : {}), ...(transport ? { transport } : {}), productAccepted: false }
    if (failure || !result) return { status: 'OWNER_APPROVED_PLANNER_BLOCKED',
      code: failure ?? 'PLANNER_ADMISSION_OR_CONTROL_FAILED', productAccepted: false }
    return { status: 'OWNER_APPROVED_PLANNER_ATTEMPTED', approvalId, requestSha256, result,
      ...(transport ? { transport } : {}), productAccepted: false }
  }
}
