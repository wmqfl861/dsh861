/** Trusted route policy; no request-supplied trust, client credentials, proxies or validation overrides. */
export interface PlannerTlsPolicy {
  record: string
  baseUrl: string
  caCertificates: readonly string[]
  peerSpkiSha256: string | null
  minVersion: 'TLSv1.2' | 'TLSv1.3'
  handshakeTimeoutMs: number
  closeTimeoutMs: number
}

/** One verified socket, not proof about subsequent CLI requests or route authorization. */
export interface PlannerTlsReceipt {
  status: 'PLANNER_TLS_PEER_VERIFIED'
  record: string
  requestSha256: string
  routeSha256: string
  trustStoreSha256: string
  peerCertificateSha256: string
  peerSpkiSha256: string
  protocol: 'TLSv1.2' | 'TLSv1.3'
  observedAt: number
  applicationBytesSent: 0
  credentialUsed: false
  socketCloseObserved: true
  scope: 'handshake-only-not-codex-connection'
}

/** Only independently provisioned verifiers belong in trusted admission services. */
export interface PlannerTlsVerifier {
  /** @param record - signed record ID. @param baseUrl - approved route. @param requestSha256 - fixed invocation.
   * @param signal - optional cancellation signal. @returns a receipt after socket close, or rejects. */
  verify(record: string, baseUrl: string, requestSha256: string, signal?: AbortSignal): Promise<Readonly<PlannerTlsReceipt>>
}

/** Fixed error code, without raw TLS diagnostics or certificate data. */
export class PlannerTlsError extends Error { readonly code: string; constructor(code: string) }
/** @param policy - independent exact-route policy. @returns bounded credential-free TLS verifier. */
export function createPlannerTlsVerifier(policy: PlannerTlsPolicy): PlannerTlsVerifier
