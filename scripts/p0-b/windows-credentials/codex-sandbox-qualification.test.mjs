import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { prepareCodexSandboxQualification } from './codex-sandbox-qualification.mjs'

const nodeSha256 = createHash('sha256').update(readFileSync(process.execPath)).digest('hex')
const code = expected => error => error.code === expected
async function fixture(t) {
  const parent = mkdtempSync(join(tmpdir(), 'dsh-probe-test-'))
  let probe
  t.after(async () => { if (probe) await probe.dispose(); rmSync(parent, { recursive: true, force: true }) })
  probe = await prepareCodexSandboxQualification({ parent, nodeExecutable: process.execPath, nodeSha256,
    systemRoot: process.platform === 'win32' ? process.env.SystemRoot : null })
  return probe
}
function run(probe) {
  const result = spawnSync(probe.command[0], probe.command.slice(1), { cwd: probe.workspace, env: probe.environment,
    encoding: 'utf8', timeout: 15000, maxBuffer: 32768, windowsHide: true, shell: false })
  return { exitCode: result.status, signal: result.signal, error: result.error, stdout: result.stdout }
}
function syntheticRestriction(baseline) {
  const receipt = JSON.parse(baseline.stdout)
  const denial = () => ({ outcome: 'error', code: 'EACCES' })
  receipt.outsideRead = denial(); receipt.insideWrite = denial(); receipt.outsideWrite = denial()
  receipt.child.receipt.result = denial()
  return { exitCode: 0, signal: null, stdout: JSON.stringify(receipt) }
}

test('real unsandboxed control reads and writes all synthetic targets; it never proves isolation', async t => {
  const probe = await fixture(t)
  const result = run(probe)
  await probe.verifyBaseline(result)
  await assert.rejects(probe.verifyRestricted(result), code('SANDBOX_SCOPE_NOT_ENFORCED'))
})

test('a qualifying parser result requires an actual baseline and unchanged host files', async t => {
  const probe = await fixture(t)
  const result = run(probe), restricted = syntheticRestriction(result)
  await assert.rejects(probe.verifyRestricted(restricted), code('SANDBOX_PROBE_BASELINE_REQUIRED'))
  await probe.verifyBaseline(result)
  const receipt = await probe.verifyRestricted(restricted)
  assert.equal(receipt.status, 'SANDBOX_SCOPE_OBSERVED')
  assert.equal(receipt.productionIsolationAccepted, false)
  assert.equal(receipt.scope, 'synthetic-command-and-descendant-only')
  assert.equal(receipt.deniedReads, 2); assert.equal(receipt.deniedWrites, 2)
})

for (const [name, change, expected] of [
  ['startup failure', r => { r.exitCode = 1 }, 'SANDBOX_PROBE_NOT_COMPLETED'],
  ['timeout even with exit zero', r => { r.timedOut = true }, 'SANDBOX_PROBE_NOT_COMPLETED'],
  ['signal even with exit zero', r => { r.signal = 'SIGTERM' }, 'SANDBOX_PROBE_NOT_COMPLETED'],
  ['missing output', r => { r.stdout = '' }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
  ['oversized output', r => { r.stdout = 'x'.repeat(16385) }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
]) test(name + ' cannot count as filesystem denial', async t => {
  const probe = await fixture(t), baseline = run(probe)
  await probe.verifyBaseline(baseline)
  const restricted = syntheticRestriction(baseline); change(restricted)
  await assert.rejects(probe.verifyRestricted(restricted), code(expected))
})

for (const [name, change, expected] of [
  ['missing outside file', r => { r.outsideRead.code = 'ENOENT' }, 'SANDBOX_SCOPE_NOT_ENFORCED'],
  ['child did not start', r => { r.child.started = false }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
  ['child timed out', r => { r.child.signal = 'SIGKILL' }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
  ['wrong nonce', r => { r.nonce = 'other' }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
  ['wrong cwd', r => { r.cwd += '-other' }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
  ['allowed read broken', r => { r.allowedRead = { outcome: 'error', code: 'EACCES' } }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
  ['same parent and child pid', r => { r.child.receipt.pid = r.pid }, 'SANDBOX_PROBE_PROTOCOL_INVALID'],
]) test(name + ' cannot produce a qualification result', async t => {
  const probe = await fixture(t), baseline = run(probe)
  await probe.verifyBaseline(baseline)
  const restricted = syntheticRestriction(baseline), receipt = JSON.parse(restricted.stdout)
  change(receipt); restricted.stdout = JSON.stringify(receipt)
  await assert.rejects(probe.verifyRestricted(restricted), code(expected))
})

test('host checks reject a write even when the process reports access denied', async t => {
  const probe = await fixture(t), baseline = run(probe)
  await probe.verifyBaseline(baseline)
  writeFileSync(join(probe.workspace, 'attempt.txt'), 'SYNTHETIC-WRITE\n')
  await assert.rejects(probe.verifyRestricted(syntheticRestriction(baseline)), code('SANDBOX_PROBE_SIDE_EFFECT_MISMATCH'))
})

test('changed policy bytes cannot receive a receipt for the old policy', async t => {
  const probe = await fixture(t), baseline = run(probe)
  await probe.verifyBaseline(baseline)
  writeFileSync(probe.configFile, 'permissions = "different"\n')
  await assert.rejects(probe.verifyRestricted(syntheticRestriction(baseline)), code('SANDBOX_PROBE_FIXTURE_CHANGED'))
})

test('command selects the host sandbox and retains managed requirements without elevating or calling a model', async t => {
  const probe = await fixture(t)
  assert.deepEqual(probe.sandboxArgs.slice(0, 4), ['sandbox', '--permission-profile', 'dsh-scope-probe', '--include-managed-config'])
  assert.equal(probe.sandboxArgs.includes('windows'), false)
  assert.match(probe.configToml, /sandbox = "unelevated"/)
  assert.match(probe.configToml, /":root" = "deny"/)
  assert.match(probe.configToml, /":minimal" = "read"/)
  assert.match(probe.configToml, /enabled = false/)
  assert.equal(Object.keys(probe.environment).some(key => /KEY|TOKEN|SECRET/.test(key)), false)
  assert.equal(probe.sandboxArgs.some(arg => /bypass|yolo|full-access/.test(arg)), false)
})

test('foreign binary is refused before allocating a probe', async t => {
  const parent = mkdtempSync(join(tmpdir(), 'dsh-probe-invalid-'))
  t.after(() => rmSync(parent, { recursive: true, force: true }))
  await assert.rejects(prepareCodexSandboxQualification({ parent, nodeExecutable: process.execPath,
    nodeSha256: '0'.repeat(64), systemRoot: process.platform === 'win32' ? process.env.SystemRoot : null }), code('SANDBOX_PROBE_BINARY_INVALID'))
})
