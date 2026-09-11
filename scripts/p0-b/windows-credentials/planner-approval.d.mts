/** Owner consent is separate from runtime isolation, TLS and cost enforcement. */
export interface PlannerOwnerDecision {
  version: 1
  purpose: 'P0-B-CODEX-PLAN'
  ownerId: string
  approvalId: string
  requestSha256: string
  approved: true
  maxAttempts: 1
  notBefore: number
  expiresAt: number
  rotationConfirmed: true
  rotationRecord: string
  transportRecord: string
  budget: Readonly<{ currency: string; limitMinorUnits: number; enforcementRecord: string }>
}

/** Only these signed bytes are accepted; keys never arrive in the envelope. */
export interface PlannerDecisionEnvelope { payload: string; signature: string }

/** Trusted deployment policy, provisioned independently of task and grant files. */
export interface PlannerApprovalPolicy {
  ownerId: string
  publicKeyPem: string
  spentDirectory: string
  maxValidityMs: number
}

/** Inspect does not consume; consume uses an exclusive persistent attempt marker. */
export interface PlannerApprovalVerifier {
  inspect(envelope: unknown, requestSha256: string): Readonly<PlannerOwnerDecision>
  consume(envelope: unknown, requestSha256: string): Promise<Readonly<PlannerOwnerDecision>>
}

/** Fixed refusal code with no source-record or filesystem cause attached. */
export class PlannerApprovalError extends Error { readonly code: string; constructor(code: string) }

/** @param value - complete affirmative owner decision. @returns canonical JSON, not a signature. */
export function plannerDecisionPayload(value: unknown): string
/** @param payload - canonical JSON. @returns domain-separated Ed25519 signing bytes. */
export function plannerDecisionSigningBytes(payload: string): Buffer
/** @param policy - independent owner trust binding and protected local ledger. @returns verifier. */
export function createPlannerApprovalVerifier(policy: PlannerApprovalPolicy): PlannerApprovalVerifier
