import assert from 'node:assert/strict'
import { createHash, X509Certificate } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createPlannerTlsVerifier } from './planner-tls.mjs'
import { certificates } from './fixtures/planner-tls-certificates.mjs'
import { loopbackTls } from './fixtures/planner-tls-server.mjs'

const digest = 'a'.repeat(64)
const errorCode = expected => error => error.code === expected && error.message === expected && error.cause === undefined
const check = (peer, overrides = {}, signal) => createPlannerTlsVerifier({ ...peer.policy, ...overrides })
  .verify('test/tls', peer.baseUrl, digest, signal)

test('trusted literal-IP peer returns certificate evidence only after socket close', async t => {
  const peer = await loopbackTls(t)
  const result = await check(peer)
  assert.equal(result.status, 'PLANNER_TLS_PEER_VERIFIED')
  assert.equal(result.scope, 'handshake-only-not-codex-connection')
  assert.equal(result.credentialUsed, false)
  assert.equal(result.applicationBytesSent, 0)
  assert.equal(result.socketCloseObserved, true)
  assert.equal(result.requestSha256, digest)
  assert.match(result.peerCertificateSha256, /^[a-f0-9]{64}$/)
  assert.match(result.trustStoreSha256, /^[a-f0-9]{64}$/)
  assert.equal(peer.stats.connections, 1)
  assert.equal(peer.stats.applicationBytes, 0)
})

test('DNS-name peer receives SNI and is checked against the route hostname', async t => {
  const peer = await loopbackTls(t, { hostname: 'localhost', maxVersion: 'TLSv1.2' })
  const result = await check(peer)
  assert.equal(result.protocol, 'TLSv1.2')
  assert.deepEqual(peer.stats.servernames, ['localhost'])
  assert.equal(peer.stats.applicationBytes, 0)
})

for (const [name, cert] of [['wrong host', certificates.wrongHost], ['expired leaf', certificates.expired]]) {
  test(`${name} is refused by a real handshake, without application data`, async t => {
    const peer = await loopbackTls(t, { cert })
    await assert.rejects(check(peer), errorCode('PLANNER_TLS_PEER_REJECTED'))
    assert.equal(peer.stats.connections, 1)
    assert.equal(peer.stats.applicationBytes, 0)
  })
}

test('test CA is not trusted when only bundled public roots are supplied', async t => {
  const { rootCertificates } = await import('node:tls')
  const peer = await loopbackTls(t)
  await assert.rejects(check(peer, { caCertificates: rootCertificates }), errorCode('PLANNER_TLS_PEER_REJECTED'))
  assert.equal(peer.stats.connections, 1)
})

test('a key pin is an additional check, not a substitute for certificate validation', async t => {
  const peer = await loopbackTls(t)
  const pin = createHash('sha256').update(new X509Certificate(certificates.valid).publicKey
    .export({ type: 'spki', format: 'der' })).digest('hex')
  assert.equal((await check(peer, { peerSpkiSha256: pin })).peerSpkiSha256, pin)
  await assert.rejects(check(peer, { peerSpkiSha256: '0'.repeat(64) }), errorCode('PLANNER_TLS_PIN_MISMATCH'))
  const bad = await loopbackTls(t, { cert: certificates.wrongHost })
  await assert.rejects(check(bad, { peerSpkiSha256: pin }), errorCode('PLANNER_TLS_PEER_REJECTED'))
})

test('TLS below the configured minimum is rejected', async t => {
  const peer = await loopbackTls(t, { maxVersion: 'TLSv1.2' })
  await assert.rejects(check(peer, { minVersion: 'TLSv1.3' }), errorCode('PLANNER_TLS_PEER_REJECTED'))
})

test('a stalled TCP peer times out; the verifier does not retry', async t => {
  const peer = await loopbackTls(t, { stall: true })
  await assert.rejects(check(peer, { handshakeTimeoutMs: 80 }), errorCode('PLANNER_TLS_TIMEOUT'))
  assert.equal(peer.stats.connections, 1)
})

test('pre-cancelled observation makes no connection', async t => {
  const peer = await loopbackTls(t)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(check(peer, {}, controller.signal), errorCode('PLANNER_TLS_CANCELLED'))
  assert.equal(peer.stats.connections, 0)
})

test('cancellation during a stalled handshake observes socket close', async t => {
  const peer = await loopbackTls(t, { stall: true })
  const controller = new AbortController()
  const pending = check(peer, {}, controller.signal)
  const rejected = assert.rejects(pending, errorCode('PLANNER_TLS_CANCELLED'))
  await delay(30); controller.abort()
  await rejected
  assert.equal(peer.stats.connections, 1)
})

test('unavailable peer rejects once, with no raw endpoint or certificate diagnostics', async t => {
  const peer = await loopbackTls(t); await peer.close()
  await assert.rejects(check(peer), errorCode('PLANNER_TLS_PEER_REJECTED'))
})

for (const [name, mutate] of [
  ['HTTP', policy => { policy.baseUrl = policy.baseUrl.replace('https:', 'http:') }],
  ['userinfo', policy => { policy.baseUrl = policy.baseUrl.replace('https://', 'https://key@') }],
  ['query', policy => { policy.baseUrl += '?key=fake' }],
  ['fragment', policy => { policy.baseUrl += '#fragment' }],
  ['empty query delimiter', policy => { policy.baseUrl += '?' }],
  ['empty trust', policy => { policy.caCertificates = [] }],
  ['garbled trust', policy => { policy.caCertificates = ['not a certificate'] }],
  ['leaf as CA', policy => { policy.caCertificates = [certificates.valid] }],
  ['validation override', policy => { policy.rejectUnauthorized = false }],
  ['invalid deadline', policy => { policy.handshakeTimeoutMs = 0 }],
]) test(`policy rejects ${name} before network access`, async t => {
  const peer = await loopbackTls(t)
  const policy = structuredClone(peer.policy); mutate(policy)
  assert.throws(() => createPlannerTlsVerifier(policy), errorCode('PLANNER_TLS_POLICY_INVALID'))
  assert.equal(peer.stats.connections, 0)
})

test('exact route and signed record must match the trusted policy', async t => {
  const peer = await loopbackTls(t)
  const verifier = createPlannerTlsVerifier(peer.policy)
  for (const [record, route, request] of [['other', peer.baseUrl, digest], ['test/tls', peer.baseUrl + '/other', digest],
    ['test/tls', peer.baseUrl, 'not-a-digest']]) {
    await assert.rejects(verifier.verify(record, route, request), errorCode('PLANNER_TLS_ROUTE_MISMATCH'))
  }
  assert.equal(peer.stats.connections, 0)
})

test('mutating the original policy cannot change the verifier or its pinned trust', async t => {
  const peer = await loopbackTls(t)
  const verifier = createPlannerTlsVerifier(peer.policy)
  peer.policy.caCertificates[0] = 'corrupt'; peer.policy.baseUrl = 'https://other.invalid'; peer.policy.record = 'other'
  const result = await verifier.verify('test/tls', peer.baseUrl, digest)
  assert.equal(result.status, 'PLANNER_TLS_PEER_VERIFIED')
})

test('a past success is not reused after the peer becomes unavailable', async t => {
  const peer = await loopbackTls(t)
  const verifier = createPlannerTlsVerifier(peer.policy)
  await verifier.verify('test/tls', peer.baseUrl, digest)
  await peer.close()
  await assert.rejects(verifier.verify('test/tls', peer.baseUrl, digest), errorCode('PLANNER_TLS_PEER_REJECTED'))
})
