import assert from 'node:assert/strict'
import { constants, createHash, createPublicKey, generateKeyPairSync, publicEncrypt, sign } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { publicConfigDigest } from '../model-config.mjs'
import { createPlannerApprovalVerifier, plannerDecisionPayload, plannerDecisionSigningBytes } from './planner-approval.mjs'
import { createOwnerApprovedPlanner, describePlannerApprovalRequest } from './owner-approved-planner.ts'
import { createPlannerTlsVerifier } from './planner-tls.mjs'
import { loopbackTls } from './fixtures/planner-tls-server.mjs'
import { certificates } from './fixtures/planner-tls-certificates.mjs'

// Native entry/PowerShell/job/gate, synthetic signing identity, sealed peer and external controls.
// TLS is real but loopback-only. This does not certify the user gateway, CLI TLS, owner-key custody, OS isolation or budget.
const directory = fileURLToPath(new URL('.', import.meta.url))
const repository = join(directory, '../../..')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const fileHash = file => digest(readFileSync(file))
const configuration = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.json'), 'utf8'))
const trustedLock = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.lock.json'), 'utf8'))
const keys = generateKeyPairSync('ed25519')
const leasedValue = 'SYNTHETIC-APPROVAL-NATIVE-KEY'

async function setup(t, options) {
  const peer = await loopbackTls(t, options)
  const base = mkdtempSync(join(tmpdir(), 'dsh-approved-native-'))
  const workspace = join(base, 'work'), spentDirectory = join(base, 'spent')
  mkdirSync(workspace); mkdirSync(spentDirectory)
  t.after(() => rmSync(base, { recursive: true, force: true }))
  writeFileSync(join(workspace, 'input.md'), 'fixed planning input\n')
  const prompt = join(base, 'prompt.txt'); writeFileSync(prompt, 'fixed prompt\n')
  writeFileSync(join(workspace, 'exec'), [
    "const {writeFileSync} = require('node:fs')",
    "writeFileSync('target-ran.json', JSON.stringify({pid:process.pid,ppid:process.ppid}))",
    'process.stdin.resume()',
    "process.stdin.on('end', () => process.stdout.write('synthetic answer\\n'))",
  ].join('\n') + '\n')
  const config = structuredClone(configuration)
  config.agents.codex.baseUrl = peer.baseUrl
  const systemRoot = process.env.SystemRoot
  const powershell = join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
  const input = { sourceCommit: 'e'.repeat(40), readSet: [{ path: 'input.md', sha256: fileHash(join(workspace, 'input.md')) }],
    run: { configuration: config, trustedLock: { ...structuredClone(trustedLock), publicConfigSha256: publicConfigDigest(config) },
      input: { platform: 'win32', workspace, runRoot: join(base, 'run'), executable: process.execPath,
        executableSha256: fileHash(process.execPath), systemRoot, toolDirectories: [join(systemRoot, 'System32')] },
      prompt: { file: prompt, sha256: fileHash(prompt) },
      bounds: { deadlineMs: 10000, terminationGraceMs: 500, maxChannelBytes: 8192,
        redactionLimits: { maxSecrets: 2, maxSecretBytes: 384 } },
      jobOwner: { powershellExecutable: powershell, directory,
        sha256: { executable: fileHash(powershell), helper: fileHash(join(directory, 'job-owner.ps1')),
          launcher: fileHash(join(directory, 'launch-gate.mjs')) },
        environment: { SystemRoot: systemRoot, TEMP: base, TMP: base }, replyTimeoutMs: 20000 } } }
  const { requestSha256 } = describePlannerApprovalRequest(input)
  const now = Date.now()
  const decision = { version: 1, purpose: 'P0-B-CODEX-PLAN', ownerId: 'synthetic-owner', approvalId: 'native-attempt',
    requestSha256, approved: true, maxAttempts: 1, notBefore: now - 1000, expiresAt: now + 120000,
    rotationConfirmed: true, rotationRecord: 'test/rotation', transportRecord: 'test/tls',
    budget: { currency: 'USD', limitMinorUnits: 25, enforcementRecord: 'test/reserved' } }
  const payload = plannerDecisionPayload(decision)
  const envelope = { payload, signature: sign(null, plannerDecisionSigningBytes(payload), keys.privateKey).toString('base64url') }
  const seen = { reads: 0, acquired: 0, closed: 0 }
  const approvals = createPlannerApprovalVerifier({ ownerId: 'synthetic-owner', spentDirectory, maxValidityMs: 180000,
    publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }) })
  const services = { approvals, transport: createPlannerTlsVerifier(peer.policy),
    bridge: async (_action, _provider, bytes) => {
      seen.reads++
      const request = JSON.parse(bytes.toString('utf8'))
      const key = createPublicKey({ format: 'jwk', key: { kty: 'RSA',
        n: Buffer.from(request.modulus, 'base64').toString('base64url'),
        e: Buffer.from(request.exponent, 'base64').toString('base64url') } })
      const ciphertext = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        Buffer.from(leasedValue)).toString('base64')
      return Buffer.from(JSON.stringify({ version: 1, requestId: request.requestId,
        status: 'SEALED', ciphertext, selfTestRemoved: false }))
    },
    acquireControls: async (claims, requestHash) => {
      seen.acquired++
      return { requestSha256: requestHash, approvalId: claims.approvalId,
        transportRecord: claims.transportRecord, rotationRecord: claims.rotationRecord,
        budget: claims.budget, isolationRecord: 'test/synthetic-isolation',
        assertActive: async () => {}, close: async () => { seen.closed++ } }
    } }
  return { input, envelope, seen, workspace, peer, invoke: createOwnerApprovedPlanner(services) }
}

test('signed admission reaches the real gated Windows consumer and cannot replay',
  { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
    const f = await setup(t)
    const result = await f.invoke(f.input, f.envelope)
    assert.equal(result.status, 'OWNER_APPROVED_PLANNER_ATTEMPTED')
    assert.equal(result.result.status, 'PROJECTED_PLANNER_COMPLETED')
    assert.equal(result.transport.status, 'PLANNER_TLS_PEER_VERIFIED')
    assert.equal(result.transport.socketCloseObserved, true)
    assert.equal(f.peer.stats.connections, 1)
    assert.equal(f.peer.stats.applicationBytes, 0)
    assert.equal(result.result.invocation.exitCode, 0)
    assert.equal(result.result.ownership.assigned, true)
    assert.equal(result.result.ownership.activeProcessesRemaining, 0)
    assert.equal(result.result.ownership.disposed, true)
    assert.equal(existsSync(join(f.workspace, 'target-ran.json')), true)
    assert.equal(f.seen.reads, 1); assert.equal(f.seen.closed, 1)
    assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_APPROVAL_USED')
    assert.equal(f.seen.reads, 1)
  })

test('altered native request is rejected before the run root, helper and credential read',
  { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
    const f = await setup(t)
    f.input.run.bounds.deadlineMs++
    assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_DECISION_MISMATCH')
    assert.equal(existsSync(f.input.run.input.runRoot), false)
    assert.equal(existsSync(join(f.workspace, 'target-ran.json')), false)
    assert.equal(f.seen.acquired, 0); assert.equal(f.seen.reads, 0)
    assert.equal(f.peer.stats.connections, 0)
  })


test('bad TLS blocks the actual native reader and CLI while closing the already-created owner',
  { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
    const f = await setup(t, { cert: certificates.wrongHost })
    const result = await f.invoke(f.input, f.envelope)
    assert.equal(result.status, 'OWNER_APPROVED_PLANNER_ATTEMPTED')
    assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
    assert.equal(result.result.ownership.disposed, true)
    assert.equal(result.result.ownership.activeProcessesRemaining, 0)
    assert.equal(f.seen.reads, 0)
    assert.equal(f.peer.stats.connections, 1)
    assert.equal(f.peer.stats.applicationBytes, 0)
    assert.equal(existsSync(join(f.workspace, 'target-ran.json')), false)
    assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_APPROVAL_USED')
    assert.equal(f.peer.stats.connections, 1)
  })
