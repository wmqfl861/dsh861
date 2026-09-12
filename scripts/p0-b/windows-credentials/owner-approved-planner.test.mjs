import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import * as crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import test from 'node:test'
import ts from '@typescript/typescript6'
import * as approval from './planner-approval.mjs'
import * as projection from './codex-launch-projection.mjs'
import { publicConfigDigest } from '../model-config.mjs'
import { createPlannerTlsVerifier } from './planner-tls.mjs'
import { loopbackTls } from './fixtures/planner-tls-server.mjs'
import { certificates } from './fixtures/planner-tls-certificates.mjs'

// Actual admission, projection, signatures and files. Native entry/credentials/enforcement are simulated.
// TLS is simulated in existing cases and real on explicit loopback integration cases.
const keys = generateKeyPairSync('ed25519')
const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' })
const root = fileURLToPath(new URL('../../../', import.meta.url))
const configuration = JSON.parse(readFileSync(path.join(root, 'config/agents/models.v1.json'), 'utf8'))
const trustedLock = JSON.parse(readFileSync(path.join(root, 'config/agents/models.v1.lock.json'), 'utf8'))
const sourcePath = fileURLToPath(new URL('./owner-approved-planner.ts', import.meta.url))
const source = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const executableSha256 = hash(readFileSync(process.execPath))

async function load(invokeProjectedPlannerOnce) {
  const context = createContext({ Buffer, structuredClone, Set, Date, Promise })
  const values = new Map([
    ['node:crypto', crypto], ['node:fs/promises', fsPromises], ['node:path', path],
    ['./planner-approval.mjs', approval], ['./codex-launch-projection.mjs', projection],
    ['./planner-entry.ts', { invokeProjectedPlannerOnce }],
  ])
  const module = new SourceTextModule(source, { context, identifier: sourcePath })
  await module.link(name => {
    const value = values.get(name)
    assert.ok(value, `unexpected runtime import ${name}`)
    return new SyntheticModule(Object.keys(value), function () {
      for (const [key, item] of Object.entries(value)) this.setExport(key, item)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}

async function fixture(t, peer) {
  const base = mkdtempSync(path.join(tmpdir(), 'dsh-approved-run-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const workspace = path.join(base, 'work'), ledger = path.join(base, 'spent')
  mkdirSync(workspace); mkdirSync(ledger)
  const allowed = path.join(workspace, 'input.md'), promptFile = path.join(base, 'prompt.txt')
  writeFileSync(allowed, 'fixed input\n'); writeFileSync(promptFile, 'fixed prompt\n')
  const configured = structuredClone(configuration)
  configured.agents.codex.baseUrl = peer?.baseUrl ?? 'https://synthetic.example.invalid/v1'
  const run = {
    configuration: configured, trustedLock: { ...structuredClone(trustedLock), publicConfigSha256: publicConfigDigest(configured) },
    input: { platform: process.platform, workspace, runRoot: path.join(base, 'run'), executable: process.execPath,
      executableSha256, systemRoot: process.platform === 'win32' ? process.env.SystemRoot : null,
      toolDirectories: [process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32') : '/usr/bin'] },
    prompt: { file: promptFile, sha256: hash(readFileSync(promptFile)) },
    bounds: { deadlineMs: 1000, terminationGraceMs: 200, maxChannelBytes: 4096, redactionLimits: { maxSecrets: 2, maxSecretBytes: 384 } },
    jobOwner: { powershellExecutable: '/synthetic/powershell', directory: '/synthetic/helpers',
      sha256: { executable: 'b'.repeat(64), helper: 'c'.repeat(64), launcher: 'd'.repeat(64) },
      environment: { SystemRoot: '/synthetic', TEMP: base, TMP: base }, replyTimeoutMs: 1000 },
  }
  const input = { sourceCommit: 'e'.repeat(40), readSet: [{ path: 'input.md', sha256: hash(readFileSync(allowed)) }], run }
  const seen = { entries: 0, reads: 0, acquired: 0, active: 0, closed: 0, tls: 0, actual: null }
  const faults = { acquire: false, active: false, close: false, mismatch: false, beforeEntry: null, duringAcquire: null }
  const api = await load(async actual => {
    seen.entries++; seen.actual = actual
    if (faults.beforeEntry) await faults.beforeEntry()
    try { await actual.bridge('READ', 'codex', Buffer.from('{}')) }
    catch { return { status: 'PROJECTED_PLANNER_REFUSED', code: 'SYNTHETIC_READ_REFUSED', productAccepted: false } }
    return { status: 'PROJECTED_PLANNER_COMPLETED', productAccepted: false }
  })
  const request = api.describePlannerApprovalRequest(input)
  const now = Date.now()
  const claims = { version: 1, purpose: 'P0-B-CODEX-PLAN', ownerId: 'synthetic-owner', approvalId: 'synthetic-attempt',
    requestSha256: request.requestSha256, approved: true, maxAttempts: 1, notBefore: now - 1000, expiresAt: now + 60000,
    rotationConfirmed: true, rotationRecord: 'test/rotation', transportRecord: 'test/tls',
    budget: { currency: 'USD', limitMinorUnits: 25, enforcementRecord: 'test/reserved-budget' } }
  const payload = approval.plannerDecisionPayload(claims)
  const envelope = { payload, signature: sign(null, approval.plannerDecisionSigningBytes(payload), keys.privateKey).toString('base64url') }
  const approvals = approval.createPlannerApprovalVerifier({ ownerId: claims.ownerId, publicKeyPem,
    spentDirectory: ledger, maxValidityMs: 120000 })
  const services = { approvals, transport: peer ? createPlannerTlsVerifier(peer.policy) : {
    verify: async (record, baseUrl, requestSha256) => {
      seen.tls++
      return { status: 'PLANNER_TLS_PEER_VERIFIED', record, requestSha256, routeSha256: hash(baseUrl),
        trustStoreSha256: 'f'.repeat(64), peerCertificateSha256: 'f'.repeat(64), peerSpkiSha256: 'f'.repeat(64),
        protocol: 'TLSv1.3', observedAt: Date.now(), applicationBytesSent: 0, credentialUsed: false,
        socketCloseObserved: true, scope: 'handshake-only-not-codex-connection' }
    },
  }, bridge: async () => { seen.reads++; return Buffer.from('{}') },
    acquireControls: async (decision, requestSha256) => {
      seen.acquired++
      if (faults.acquire) throw new Error('control service unavailable')
      if (faults.duringAcquire) await faults.duringAcquire()
      return { requestSha256: faults.mismatch ? '0'.repeat(64) : requestSha256, approvalId: decision.approvalId,
        transportRecord: decision.transportRecord, rotationRecord: decision.rotationRecord,
        budget: { ...decision.budget }, isolationRecord: 'test/native-read-only',
        assertActive: async () => { seen.active++; if (faults.active) throw new Error('reservation or isolation revoked') },
        close: async () => { seen.closed++; if (faults.close) throw new Error('reservation final state unknown') } }
    } }
  return { api, input, envelope, services, seen, faults, allowed, promptFile, ledger,
    invoke: api.createOwnerApprovedPlanner(services) }
}

test('signed exact request and live controls reach the existing consumer and reader once', async t => {
  const f = await fixture(t)
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.status, 'OWNER_APPROVED_PLANNER_ATTEMPTED')
  assert.equal(result.productAccepted, false)
  assert.equal(f.seen.entries, 1); assert.equal(f.seen.reads, 1); assert.equal(f.seen.closed, 1)
  assert.equal(f.seen.actual.approval.record, 'synthetic-attempt')
  assert.equal(f.seen.actual.approval.transportEvidenceRecord, 'test/tls')
  assert.equal(f.seen.active, 4)
  assert.equal(f.seen.tls, 1)
  const replay = await f.invoke(f.input, f.envelope)
  assert.equal(replay.code, 'PLANNER_APPROVAL_USED'); assert.equal(f.seen.entries, 1)
})

test('missing decision cannot reach controls, native entry or credential transport', async t => {
  const f = await fixture(t)
  assert.equal((await f.invoke(f.input, null)).status, 'OWNER_APPROVED_PLANNER_BLOCKED')
  assert.equal(f.seen.acquired + f.seen.entries + f.seen.reads, 0)
  assert.equal(readdirSync(f.ledger).length, 0)
})

for (const [name, mutate] of [
  ['source revision', value => { value.sourceCommit = 'f'.repeat(40) }],
  ['prompt hash', value => { value.run.prompt.sha256 = 'f'.repeat(64) }],
  ['executable hash', value => { value.run.input.executableSha256 = 'f'.repeat(64) }],
  ['runtime helper hash', value => { value.run.jobOwner.sha256.launcher = 'f'.repeat(64) }],
  ['deadline', value => { value.run.bounds.deadlineMs += 1 }],
  ['read set', value => { value.readSet[0].sha256 = 'f'.repeat(64) }],
  ['run root', value => { value.run.input.runRoot += '-other' }],
]) test(`changing ${name} cannot reuse the decision`, async t => {
  const f = await fixture(t); mutate(f.input)
  assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_DECISION_MISMATCH')
  assert.equal(f.seen.acquired + f.seen.entries + f.seen.reads, 0)
})

test('the approved HTTP declaration is still refused without touching credentials', async t => {
  const f = await fixture(t)
  f.input.run.configuration = configuration; f.input.run.trustedLock = trustedLock
  assert.equal((await f.invoke(f.input, f.envelope)).status, 'OWNER_APPROVED_PLANNER_BLOCKED')
  assert.equal(f.seen.acquired + f.seen.entries + f.seen.reads, 0)
})

test('changed admitted file bytes fail before spending or acquiring controls', async t => {
  const f = await fixture(t); writeFileSync(f.allowed, 'changed')
  assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_READ_SET_CHANGED')
  assert.equal(f.seen.acquired + f.seen.entries + f.seen.reads, 0)
  assert.equal(readdirSync(f.ledger).length, 0)
})

test('missing enforcement cannot be replaced by a valid signature', async t => {
  const f = await fixture(t); f.faults.acquire = true
  assert.equal((await f.invoke(f.input, f.envelope)).status, 'OWNER_APPROVED_PLANNER_BLOCKED')
  assert.equal(f.seen.entries + f.seen.reads, 0)
  assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_APPROVAL_USED')
})

test('a mismatched reservation is closed and cannot reach the entry', async t => {
  const f = await fixture(t); f.faults.mismatch = true
  assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_CONTROL_BINDING_MISMATCH')
  assert.equal(f.seen.closed, 1); assert.equal(f.seen.entries + f.seen.reads, 0)
})

test('revocation between admission and credential read blocks the read', async t => {
  const f = await fixture(t); f.faults.beforeEntry = () => { f.faults.active = true }
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(f.seen.entries, 1); assert.equal(f.seen.reads, 0); assert.equal(f.seen.closed, 1)
})

test('post-admission file changes are rejected at the actual reader boundary', async t => {
  const f = await fixture(t); f.faults.beforeEntry = () => writeFileSync(f.promptFile, 'different input')
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(f.seen.reads, 0)
})

test('callers cannot mutate the signed input while controls are being acquired', async t => {
  const f = await fixture(t)
  f.faults.duringAcquire = () => { f.input.run.prompt.file = '/other'; f.input.run.bounds.deadlineMs = 9 }
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.status, 'OWNER_APPROVED_PLANNER_ATTEMPTED')
  assert.equal(f.seen.actual.prompt.file, f.promptFile)
  assert.equal(f.seen.actual.bounds.deadlineMs, 1000)
})

test('unknown control cleanup is not a completed attempt', async t => {
  const f = await fixture(t); f.faults.close = true
  assert.equal((await f.invoke(f.input, f.envelope)).status, 'OWNER_APPROVED_PLANNER_CLEANUP_BLOCKED')
  assert.equal(f.seen.closed, 1)
})

test('concurrent same-decision calls do not reserve budget or invoke twice', async t => {
  const f = await fixture(t)
  const results = await Promise.all([f.invoke(f.input, f.envelope), f.invoke(f.input, f.envelope)])
  assert.equal(results.filter(value => value.status === 'OWNER_APPROVED_PLANNER_ATTEMPTED').length, 1)
  assert.equal(f.seen.acquired, 1); assert.equal(f.seen.reads, 1)
})


test('actual loopback TLS verification is recorded before the credential read', async t => {
  const peer = await loopbackTls(t)
  const f = await fixture(t, peer)
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.status, 'OWNER_APPROVED_PLANNER_ATTEMPTED')
  assert.equal(result.transport.status, 'PLANNER_TLS_PEER_VERIFIED')
  assert.equal(result.transport.requestSha256, result.requestSha256)
  assert.equal(result.transport.socketCloseObserved, true)
  assert.equal(f.seen.reads, 1)
  assert.equal(peer.stats.connections, 1)
  assert.equal(peer.stats.applicationBytes, 0)
})

for (const [name, options] of [['wrong hostname', { cert: certificates.wrongHost }], ['expired certificate', { cert: certificates.expired }],
  ['handshake timeout', { stall: true }]]) {
  test(`actual TLS ${name} prevents reading and consumes no second attempt`, async t => {
    const peer = await loopbackTls(t, options)
    if (options.stall) peer.policy.handshakeTimeoutMs = 80
    const f = await fixture(t, peer)
    const result = await f.invoke(f.input, f.envelope)
    assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
    assert.equal(f.seen.reads, 0)
    assert.equal(f.seen.closed, 1)
    assert.equal(peer.stats.connections, 1)
    assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_APPROVAL_USED')
    assert.equal(peer.stats.connections, 1)
  })
}

test('unapproved input never initiates even a credential-free TLS handshake', async t => {
  const peer = await loopbackTls(t)
  const f = await fixture(t, peer)
  await f.invoke(f.input, null)
  assert.equal(peer.stats.connections, 0)
  assert.equal(f.seen.reads, 0)
})

test('live controls revoked during TLS cannot be hidden by a successful handshake', async t => {
  const f = await fixture(t)
  const original = f.services.transport.verify
  f.services.transport.verify = async (...args) => {
    const receipt = await original(...args)
    f.faults.active = true
    return receipt
  }
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(f.seen.reads, 0)
  assert.equal(f.seen.closed, 1)
})
