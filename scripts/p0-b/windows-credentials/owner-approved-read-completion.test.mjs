import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import * as files from 'node:fs/promises'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import * as approval from './planner-approval.mjs'

// Real admission source, signatures, lease ledger and input files. Projection,
// Windows entry, TLS, secret peer and runtime enforcement are explicit doubles.
const sourceFile = fileURLToPath(new URL('./owner-approved-planner.ts', import.meta.url))
const source = ts.transpileModule(readFileSync(sourceFile, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const keys = crypto.generateKeyPairSync('ed25519')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

async function fixture(t) {
  const base = mkdtempSync(path.join(tmpdir(), 'dsh-read-completion-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const workspace = path.join(base, 'work'), spent = path.join(base, 'spent')
  mkdirSync(workspace); mkdirSync(spent)
  const file = path.join(workspace, 'input.md'), prompt = path.join(base, 'prompt.txt')
  writeFileSync(file, 'fixed input\n'); writeFileSync(prompt, 'fixed prompt\n')
  const seen = { entries: 0, reads: 0, released: 0, closed: 0, tls: 0, rejection: null }
  const faults = { revoked: false, close: false, beforeReadReturns: async () => {} }
  const route = { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
    baseUrl: 'https://synthetic.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' }
  const context = createContext({ Buffer, Date, Promise, Set, structuredClone })
  const imports = new Map([
    ['node:crypto', crypto], ['node:fs/promises', files], ['node:path', path],
    ['./planner-approval.mjs', approval],
    ['./codex-launch-projection.mjs', { projectCodexLaunch: (_config, _lock, input) => ({ ...input, route }) }],
    ['./planner-entry.ts', { invokeProjectedPlannerOnce: async input => {
      seen.entries++
      try {
        const result = await input.bridge('READ', 'codex', Buffer.from('{}'))
        assert.equal(result.toString(), 'synthetic-sealed-envelope')
        seen.released++
        return { status: 'PROJECTED_PLANNER_COMPLETED', productAccepted: false }
      } catch (error) {
        seen.rejection = error.code ?? error.message
        return { status: 'PROJECTED_PLANNER_REFUSED', code: 'SYNTHETIC_READ_REFUSED', productAccepted: false }
      }
    } }],
  ])
  const module = new SourceTextModule(source, { context, identifier: sourceFile })
  await module.link(name => {
    const value = imports.get(name)
    assert.ok(value, `unconfigured import: ${name}`)
    return new SyntheticModule(Object.keys(value), function () {
      for (const [key, item] of Object.entries(value)) this.setExport(key, item)
    }, { context })
  })
  await module.evaluate()
  const api = module.namespace
  const input = { sourceCommit: 'a'.repeat(40), readSet: [{ path: 'input.md', sha256: hash(readFileSync(file)) }],
    run: { configuration: {}, trustedLock: {}, input: { workspace, runRoot: path.join(base, 'run') },
      prompt: { file: prompt, sha256: hash(readFileSync(prompt)) }, bounds: {}, jobOwner: {} } }
  const request = api.describePlannerApprovalRequest(input)
  const now = Date.now()
  const claims = { version: 1, purpose: 'P0-B-CODEX-PLAN', ownerId: 'synthetic-owner', approvalId: 'one-read-attempt',
    requestSha256: request.requestSha256, approved: true, maxAttempts: 1, notBefore: now - 1000, expiresAt: now + 60000,
    rotationConfirmed: true, rotationRecord: 'test/rotation', transportRecord: 'test/tls',
    budget: { currency: 'USD', limitMinorUnits: 1, enforcementRecord: 'test/budget' } }
  const payload = approval.plannerDecisionPayload(claims)
  const envelope = { payload, signature: crypto.sign(null, approval.plannerDecisionSigningBytes(payload), keys.privateKey)
    .toString('base64url') }
  const verifier = approval.createPlannerApprovalVerifier({ ownerId: claims.ownerId,
    publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }), spentDirectory: spent, maxValidityMs: 120000 })
  const lease = { requestSha256: claims.requestSha256, approvalId: claims.approvalId,
    transportRecord: claims.transportRecord, rotationRecord: claims.rotationRecord, budget: { ...claims.budget },
    isolationRecord: 'test/isolation', assertActive: async () => {
      if (faults.revoked) throw new Error('SYNTHETIC_CONTROL_REVOKED')
    }, close: async () => { seen.closed++; if (faults.close) throw new Error('SYNTHETIC_CLOSE_FAILED') } }
  const services = { approvals: verifier, acquireControls: async () => lease,
    transport: { verify: async () => { seen.tls++; return { status: 'PLANNER_TLS_PEER_VERIFIED', socketCloseObserved: true } } },
    bridge: async () => {
      seen.reads++
      await faults.beforeReadReturns()
      return Buffer.from('synthetic-sealed-envelope')
    } }
  return { input, envelope, file, prompt, claims, lease, seen, faults, invoke: api.createOwnerApprovedPlanner(services) }
}

test('an unchanged authorization releases exactly one completed sealed read', async t => {
  const f = await fixture(t)
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.result.status, 'PROJECTED_PLANNER_COMPLETED')
  assert.equal(f.seen.released, 1); assert.equal(f.seen.reads, 1); assert.equal(f.seen.closed, 1)
  assert.equal((await f.invoke(f.input, f.envelope)).code, 'PLANNER_APPROVAL_USED')
  assert.equal(f.seen.reads, 1)
})

for (const [name, mutate, expected] of [
  ['control revocation', f => { f.faults.revoked = true }, 'SYNTHETIC_CONTROL_REVOKED'],
  ['consent expiry', (f, t) => { t.mock.method(Date, 'now', () => f.claims.expiresAt) }, 'PLANNER_DECISION_EXPIRED'],
  ['prompt replacement', f => writeFileSync(f.prompt, 'new prompt'), 'PLANNER_INPUT_NOT_FIXED'],
  ['read-set replacement', f => writeFileSync(f.file, 'new input'), 'PLANNER_READ_SET_CHANGED'],
  ['reservation rebinding', f => { f.lease.budget.limitMinorUnits = 2 }, 'PLANNER_CONTROL_BINDING_MISMATCH'],
]) test(`${name} while the sealed read is pending prevents downstream release`, async t => {
  const f = await fixture(t)
  f.faults.beforeReadReturns = async () => {
    await Promise.resolve()
    mutate(f, t)
  }
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(f.seen.rejection, expected)
  assert.equal(f.seen.released, 0)
  assert.equal(f.seen.reads, 1, 'authorized read had already started; no zero-read claim')
  assert.equal(f.seen.closed, 1)
  // Restore wall clock so the replay proves spent-state rejection, not expiry.
  t.mock.restoreAll()
  assert.equal((await f.invoke(f.input, f.envelope)).status, 'OWNER_APPROVED_PLANNER_BLOCKED')
  assert.equal(f.seen.reads, 1)
})

test('a post-read refusal with failed control cleanup cannot become completed', async t => {
  const f = await fixture(t)
  f.faults.beforeReadReturns = async () => { f.faults.revoked = true; f.faults.close = true }
  const result = await f.invoke(f.input, f.envelope)
  assert.equal(result.status, 'OWNER_APPROVED_PLANNER_CLEANUP_BLOCKED')
  assert.equal(result.result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(f.seen.released, 0); assert.equal(f.seen.closed, 1)
})
