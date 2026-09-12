import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { createPlannerApprovalVerifier, plannerDecisionPayload, plannerDecisionSigningBytes } from './planner-approval.mjs'

// Every signing key is ephemeral, synthetic and unrelated to a model API key or owner identity.
const keys = generateKeyPairSync('ed25519')
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' })
const digest = 'a'.repeat(64)
function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-approval-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const policy = { ownerId: 'synthetic-owner', publicKeyPem, spentDirectory: directory, maxValidityMs: 120000 }
  const now = Date.now()
  const claims = { version: 1, purpose: 'P0-B-CODEX-PLAN', ownerId: policy.ownerId, approvalId: 'synthetic-attempt',
    requestSha256: digest, approved: true, maxAttempts: 1, notBefore: now - 1000, expiresAt: now + 60000,
    rotationConfirmed: true, rotationRecord: 'test/rotation', transportRecord: 'test/tls',
    budget: { currency: 'USD', limitMinorUnits: 25, enforcementRecord: 'test/reservation' } }
  return { directory, policy, claims, verifier: createPlannerApprovalVerifier(policy) }
}
function signed(claims, privateKey = keys.privateKey) {
  const payload = plannerDecisionPayload(claims)
  return { payload, signature: sign(null, plannerDecisionSigningBytes(payload), privateKey).toString('base64url') }
}
function rawSigned(payload) {
  return { payload, signature: sign(null, plannerDecisionSigningBytes(payload), keys.privateKey).toString('base64url') }
}
const code = expected => error => error.code === expected

test('real Ed25519 verification inspects without spending and consumes one exact request', async t => {
  const f = setup(t)
  const envelope = signed(f.claims)
  assert.equal(f.verifier.inspect(envelope, digest).approvalId, f.claims.approvalId)
  assert.equal(readdirSync(f.directory).length, 0)
  await f.verifier.consume(envelope, digest)
  assert.equal(readdirSync(f.directory).length, 1)
  const marker = JSON.parse(readFileSync(join(f.directory, readdirSync(f.directory)[0]), 'utf8'))
  assert.equal(marker.requestSha256, digest)
  await assert.rejects(f.verifier.consume(envelope, digest), code('PLANNER_APPROVAL_USED'))
})

test('a concurrent replay reaches the exclusive marker once', async t => {
  const f = setup(t), envelope = signed(f.claims)
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => f.verifier.consume(envelope, digest)))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  for (const result of results.filter(result => result.status === 'rejected')) assert.equal(result.reason.code, 'PLANNER_APPROVAL_USED')
})

test('a fresh process cannot replay an already spent signed decision', async t => {
  const f = setup(t), envelope = signed(f.claims)
  await f.verifier.consume(envelope, digest)
  const moduleUrl = new URL('./planner-approval.mjs', import.meta.url).href
  const program = `import {createPlannerApprovalVerifier} from ${JSON.stringify(moduleUrl)};
    const [p,e,d] = JSON.parse(process.argv[1]);
    try { await createPlannerApprovalVerifier(p).consume(e,d); process.exitCode=1 }
    catch(error) { if(error.code !== 'PLANNER_APPROVAL_USED') process.exitCode=2 }`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', program, JSON.stringify([f.policy, envelope, digest])],
    { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr)
})

test('unknown signer and tampered signatures never create a marker', t => {
  const f = setup(t)
  const other = generateKeyPairSync('ed25519')
  assert.throws(() => f.verifier.inspect(signed(f.claims, other.privateKey), digest), code('PLANNER_SIGNATURE_INVALID'))
  const envelope = signed(f.claims)
  envelope.signature = (envelope.signature[0] === 'A' ? 'B' : 'A') + envelope.signature.slice(1)
  assert.throws(() => f.verifier.inspect(envelope, digest), code('PLANNER_SIGNATURE_INVALID'))
  assert.equal(readdirSync(f.directory).length, 0)
})

test('payload changes, including monetary ceiling changes, invalidate the signature', t => {
  const f = setup(t), envelope = signed(f.claims)
  envelope.payload = envelope.payload.replace('"limitMinorUnits":25', '"limitMinorUnits":2500')
  assert.throws(() => f.verifier.inspect(envelope, digest), code('PLANNER_SIGNATURE_INVALID'))
})

for (const [name, change] of [
  ['other owner', claims => { claims.ownerId = 'someone-else' }],
  ['other request', claims => { claims.requestSha256 = 'b'.repeat(64) }],
]) test(`signed ${name} is not authority for this invocation`, t => {
  const f = setup(t); change(f.claims)
  assert.throws(() => f.verifier.inspect(signed(f.claims), digest), code('PLANNER_DECISION_MISMATCH'))
})
for (const [name, change] of [
  ['expired', claims => { claims.expiresAt = Date.now() - 1; claims.notBefore = claims.expiresAt - 1000 }],
  ['not yet valid', claims => { claims.notBefore = Date.now() + 10000; claims.expiresAt = claims.notBefore + 1000 }],
  ['validity beyond service policy', claims => { claims.expiresAt = claims.notBefore + 120001 }],
]) test(name + ' is refused', t => {
  const f = setup(t); change(f.claims)
  assert.throws(() => f.verifier.inspect(signed(f.claims), digest), code('PLANNER_DECISION_EXPIRED'))
})
for (const [name, change] of [
  ['unapproved', claims => { claims.approved = false }],
  ['rotation unknown', claims => { claims.rotationConfirmed = false }],
  ['multiple attempts', claims => { claims.maxAttempts = 2 }],
  ['fractional minor units', claims => { claims.budget.limitMinorUnits = 1.5 }],
  ['zero budget', claims => { claims.budget.limitMinorUnits = 0 }],
  ['wrong scalar type', claims => { claims.ownerId = 123 }],
  ['embedded authority key', claims => { claims.publicKeyPem = publicKeyPem }],
]) test(name + ' is not a valid decision even if signed', t => {
  const f = setup(t); change(f.claims)
  assert.throws(() => f.verifier.inspect(rawSigned(JSON.stringify(f.claims)), digest), code('PLANNER_DECISION_INVALID'))
})

test('noncanonical and duplicate-key payloads are refused despite a valid signature', t => {
  const f = setup(t)
  const canonical = plannerDecisionPayload(f.claims)
  for (const payload of [canonical + '\n', canonical.replace('"version":1', '"version":0,"version":1')]) {
    assert.throws(() => f.verifier.inspect(rawSigned(payload), digest), code('PLANNER_DECISION_INVALID'))
  }
})

test('malformed envelopes and key substitution fields are refused', t => {
  const f = setup(t), envelope = signed(f.claims)
  for (const bad of [null, [], { ...envelope, publicKeyPem }, { ...envelope, signature: 'AA' },
    { ...envelope, payload: 'x'.repeat(16385) }]) {
    assert.throws(() => f.verifier.inspect(bad, digest), code('PLANNER_SIGNATURE_INVALID'))
  }
})

test('no directory creation or implicit recovery occurs for an unavailable ledger', async t => {
  const f = setup(t)
  const verifier = createPlannerApprovalVerifier({ ...f.policy, spentDirectory: join(f.directory, 'missing') })
  await assert.rejects(verifier.consume(signed(f.claims), digest), code('PLANNER_APPROVAL_LEDGER_UNAVAILABLE'))
  assert.equal(readdirSync(f.directory).length, 0)
})

test('ledger links are refused rather than followed', async t => {
  const f = setup(t)
  const target = join(f.directory, 'target')
  // A Windows directory junction does not require file-symlink privileges.
  symlinkSync(f.directory, target, process.platform === 'win32' ? 'junction' : 'dir')
  const verifier = createPlannerApprovalVerifier({ ...f.policy, spentDirectory: target })
  try {
    await assert.rejects(verifier.consume(signed(f.claims), digest), code('PLANNER_APPROVAL_LEDGER_UNAVAILABLE'))
  } finally { unlinkSync(target) }
})
