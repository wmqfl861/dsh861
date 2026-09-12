/** Credential-free, exact-route TLS observations using an independently configured trust store. */
import { createHash, X509Certificate } from 'node:crypto'
import { isIP } from 'node:net'
import { performance } from 'node:perf_hooks'
import { checkServerIdentity, connect, createSecureContext } from 'node:tls'

const SHA256 = /^[a-f0-9]{64}$/
const RECORD = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

/** Fixed codes intentionally omit certificate text, addresses and underlying errors. */
export class PlannerTlsError extends Error {
  /** @param {string} code - public refusal code. */
  constructor(code) { super(code); this.name = 'PlannerTlsError'; this.code = code }
}
const refuse = code => { throw new PlannerTlsError(code) }

/**
 * Create a TLS-only verifier; configuration comes from the trusted deployment, not an approval envelope.
 * It makes no HTTP request, sends no credential and never retries or follows redirects.
 * @param {{record:string, baseUrl:string, caCertificates:readonly string[], peerSpkiSha256:string|null,
 * minVersion:'TLSv1.2'|'TLSv1.3', handshakeTimeoutMs:number, closeTimeoutMs:number}} policy - exact endpoint and explicit trust.
 * @returns {{verify:Function}} one fresh, bounded observation per verify call; no cached pass.
 */
export function createPlannerTlsVerifier(policy) {
  const fields = ['record', 'baseUrl', 'caCertificates', 'peerSpkiSha256', 'minVersion', 'handshakeTimeoutMs', 'closeTimeoutMs']
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)
    || Object.keys(policy).length !== fields.length || !fields.every(field => Object.hasOwn(policy, field))
    || typeof policy.record !== 'string' || !RECORD.test(policy.record)
    || typeof policy.baseUrl !== 'string' || policy.baseUrl.length > 4096 || /[\u0000-\u0020\\]/.test(policy.baseUrl)
    || !Array.isArray(policy.caCertificates) || policy.caCertificates.length < 1 || policy.caCertificates.length > 256
    || (policy.peerSpkiSha256 !== null && (typeof policy.peerSpkiSha256 !== 'string' || !SHA256.test(policy.peerSpkiSha256)))
    || !['TLSv1.2', 'TLSv1.3'].includes(policy.minVersion)
    || ![policy.handshakeTimeoutMs, policy.closeTimeoutMs].every(value => Number.isSafeInteger(value)
      && value > 0 && value <= 2147483647)) {
    refuse('PLANNER_TLS_POLICY_INVALID')
  }
  let url
  try { url = new URL(policy.baseUrl) } catch { refuse('PLANNER_TLS_POLICY_INVALID') }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash
    || url.href.includes('?') || url.href.includes('#')) refuse('PLANNER_TLS_POLICY_INVALID')
  const host = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname
  const port = url.port ? Number(url.port) : 443
  if (port < 1 || port > 65535) refuse('PLANNER_TLS_POLICY_INVALID')
  let authorities, secureContext
  try {
    authorities = policy.caCertificates.map(value => {
      if (typeof value !== 'string' || Buffer.byteLength(value) > 65536
        || !/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(value)) {
        refuse('PLANNER_TLS_POLICY_INVALID')
      }
      const certificate = new X509Certificate(value)
      if (!certificate.ca) refuse('PLANNER_TLS_POLICY_INVALID')
      return certificate.toString()
    })
    secureContext = createSecureContext({ ca: authorities, minVersion: policy.minVersion })
  } catch { refuse('PLANNER_TLS_POLICY_INVALID') }
  const configured = Object.freeze({ record: policy.record, baseUrl: policy.baseUrl, peerSpkiSha256: policy.peerSpkiSha256,
    handshakeTimeoutMs: policy.handshakeTimeoutMs, closeTimeoutMs: policy.closeTimeoutMs,
    trustStoreSha256: hash(JSON.stringify(authorities)) })

  const verify = async (record, baseUrl, requestSha256, signal) => {
    if (record !== configured.record || baseUrl !== configured.baseUrl || typeof requestSha256 !== 'string'
      || !SHA256.test(requestSha256)) refuse('PLANNER_TLS_ROUTE_MISMATCH')
    if (signal?.aborted) refuse('PLANNER_TLS_CANCELLED')
    return new Promise((resolve, reject) => {
      let socket, terminal, timer, closeTimer
      const started = performance.now()
      const clear = () => {
        clearTimeout(timer); clearTimeout(closeTimer)
        signal?.removeEventListener('abort', onAbort)
      }
      const stop = (error, receipt) => {
        if (terminal) return
        terminal = { error, receipt }
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        if (!socket) { clear(); reject(error ?? new PlannerTlsError('PLANNER_TLS_PEER_REJECTED')); return }
        // Success is returned only after this exact socket closes, not after destroy() is requested.
        closeTimer = setTimeout(() => {
          socket.destroy(); socket.unref(); clear()
          reject(new PlannerTlsError('PLANNER_TLS_CLOSE_UNOBSERVED'))
        }, configured.closeTimeoutMs)
        socket.destroy()
      }
      const onAbort = () => { stop(new PlannerTlsError('PLANNER_TLS_CANCELLED')) }
      timer = setTimeout(() => { stop(new PlannerTlsError('PLANNER_TLS_TIMEOUT')) }, configured.handshakeTimeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        socket = connect({ host, port, ...(isIP(host) ? {} : { servername: host }), secureContext,
          rejectUnauthorized: true, checkServerIdentity, highWaterMark: 4096 })
      } catch { stop(new PlannerTlsError('PLANNER_TLS_CONNECT_FAILED')); return }
      socket.on('error', () => { stop(new PlannerTlsError('PLANNER_TLS_PEER_REJECTED')) })
      socket.once('close', hadError => {
        clear()
        if (!terminal || terminal.error || hadError) {
          reject(terminal?.error ?? new PlannerTlsError('PLANNER_TLS_PEER_REJECTED'))
        } else {
          resolve(Object.freeze({ ...terminal.receipt, socketCloseObserved: true }))
        }
      })
      socket.once('secureConnect', () => {
        if (terminal) return
        if (signal?.aborted) { onAbort(); return }
        if (performance.now() - started >= configured.handshakeTimeoutMs) {
          stop(new PlannerTlsError('PLANNER_TLS_TIMEOUT')); return
        }
        try {
          const peer = socket.getPeerCertificate()
          // Explicit host verification also covers literal IPs, for which no SNI is sent.
          if (!socket.authorized || checkServerIdentity(host, peer) || !Buffer.isBuffer(peer.raw)) {
            refuse('PLANNER_TLS_PEER_REJECTED')
          }
          const protocol = socket.getProtocol()
          if (!['TLSv1.2', 'TLSv1.3'].includes(protocol)) refuse('PLANNER_TLS_PEER_REJECTED')
          const certificate = new X509Certificate(peer.raw)
          const peerSpkiSha256 = hash(certificate.publicKey.export({ type: 'spki', format: 'der' }))
          if (configured.peerSpkiSha256 !== null && peerSpkiSha256 !== configured.peerSpkiSha256) {
            refuse('PLANNER_TLS_PIN_MISMATCH')
          }
          stop(undefined, { status: 'PLANNER_TLS_PEER_VERIFIED', record, requestSha256,
            routeSha256: hash(baseUrl), trustStoreSha256: configured.trustStoreSha256,
            peerCertificateSha256: hash(peer.raw), peerSpkiSha256, protocol, observedAt: Date.now(),
            applicationBytesSent: 0, credentialUsed: false, scope: 'handshake-only-not-codex-connection' })
        } catch (error) {
          stop(error instanceof PlannerTlsError ? error : new PlannerTlsError('PLANNER_TLS_PEER_REJECTED'))
        }
      })
    })
  }
  return Object.freeze({ verify })
}
