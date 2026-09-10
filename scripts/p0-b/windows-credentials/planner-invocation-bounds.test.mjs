import assert from 'node:assert/strict'
import { constants, createHash, createPublicKey, publicEncrypt } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { invokePlannerOnce, PlannerInvocationError } from './planner-invocation.ts'

// Real Node processes and RSA/lease/redaction composition, but an explicitly
// synthetic credential peer. No native store, product CLI, or model request.
const key = 'SYNTHETIC-BOUNDS-KEY-d79a14'
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const executableHash = digest(readFileSync(process.execPath))

function fixture(t, program) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh861-planner-bounds-'))
  t.after(async () => {
    if (existsSync(join(directory, 'descendant.started'))) {
      writeFileSync(join(directory, 'descendant.stop'), '')
      const end = Date.now() + 5000
      while (!existsSync(join(directory, 'descendant.exiting')) && Date.now() < end) await delay(20)
      assert.equal(existsSync(join(directory, 'descendant.exiting')), true, 'owned descendant did not acknowledge cleanup')
    }
    rmSync(directory, { recursive: true, force: true })
  })
  const promptFile = join(directory, 'input.txt')
  const cliFile = join(directory, 'synthetic.mjs')
  writeFileSync(promptFile, 'fixed planning input\n')
  writeFileSync(cliFile, program)
  const observation = { reads: 0, onRead: undefined }
  const route = { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
    baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' }
  const spec = {
    approval: { record: 'synthetic-owner-record', transportEvidenceRecord: 'synthetic-transport-record',
      subject: { agent: 'codex', model: route.model, reasoningEffort: route.reasoningEffort, baseUrl: route.baseUrl } },
    route,
    prompt: { file: promptFile, sha256: digest(readFileSync(promptFile)) },
    cli: { executable: process.execPath, sha256: executableHash, args: [cliFile] },
    bridge: async (action, provider, bytes) => {
      observation.reads++
      assert.equal(action, 'Read')
      assert.equal(provider, 'codex')
      observation.onRead?.()
      const request = JSON.parse(bytes.toString())
      const publicKey = createPublicKey({ format: 'jwk', key: { kty: 'RSA',
        n: Buffer.from(request.modulus, 'base64').toString('base64url'),
        e: Buffer.from(request.exponent, 'base64').toString('base64url') } })
      const ciphertext = publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256' }, Buffer.from(key)).toString('base64')
      return Buffer.from(JSON.stringify({ version: 1, requestId: request.requestId,
        status: 'SEALED', ciphertext, selfTestRemoved: false }))
    },
    process: { workingDirectory: directory, environment: {},
      credentialEnvironmentVariable: 'DSH_SYNTHETIC_KEY', deadlineMs: 5000,
      terminationGraceMs: 300, maxChannelBytes: 4096 },
    redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 },
  }
  return { directory, spec, observation }
}

function assertBounded(result, bound) {
  assert.ok(Buffer.byteLength(result.redactedStdout, 'utf8') <= bound, 'stdout exceeded the byte bound')
  assert.ok(Buffer.byteLength(result.redactedStderr, 'utf8') <= bound, 'stderr exceeded the byte bound')
  assert.equal(JSON.stringify(result).includes(key), false)
  assert.equal(result.productAccepted, false)
}

for (const channel of ['stdout', 'stderr']) {
  test(`bounds ${channel} by UTF-8 bytes, not UTF-16 length`, async t => {
    const { spec } = fixture(t, `process.stdin.resume(); process.${channel}.write('你'.repeat(1000))\n`)
    spec.process.maxChannelBytes = 1100
    const result = await invokePlannerOnce(spec)
    assert.equal(result.cancellationReason, 'OUTPUT_BOUND_EXCEEDED')
    assertBounded(result, 1100)
  })
}

test('EOF-flushed delayed text cannot bypass the byte bound', async t => {
  const { spec } = fixture(t, "process.stdin.resume(); process.stdout.write('0123456789')\n")
  spec.process.maxChannelBytes = 9
  const result = await invokePlannerOnce(spec)
  assert.equal(result.cancellationReason, 'OUTPUT_BOUND_EXCEEDED')
  assertBounded(result, 9)
})

test('discard a violating fragment before retaining it', async t => {
  const { spec } = fixture(t, "process.stdin.resume(); process.stdout.write('A'.repeat(200000))\n")
  spec.process.maxChannelBytes = 32
  const result = await invokePlannerOnce(spec)
  assert.equal(result.cancellationReason, 'OUTPUT_BOUND_EXCEEDED')
  assertBounded(result, 32)
})

test('replacement-marker expansion counts toward the byte bound and retains detection', async t => {
  const { spec } = fixture(t, 'process.stdin.resume(); process.stdout.write(process.env.DSH_SYNTHETIC_KEY)\n')
  spec.process.maxChannelBytes = 1
  const result = await invokePlannerOnce(spec)
  assert.equal(result.cancellationReason, 'OUTPUT_BOUND_EXCEEDED')
  assert.equal(result.secretLeakDetected, true)
  assertBounded(result, 1)
})

test('exact-bound UTF-8 text survives normal EOF unchanged', async t => {
  const { spec } = fixture(t, "process.stdin.resume(); process.stdout.write('你'.repeat(16))\n")
  spec.process.maxChannelBytes = 48
  const result = await invokePlannerOnce(spec)
  assert.equal(result.status, 'PLANNER_INVOCATION_COMPLETED')
  assert.equal(result.redactedStdout, '你'.repeat(16))
  assert.equal(result.exitCode, 0)
  assertBounded(result, 48)
})

const rejectedUrls = ['https://', 'https://name:password@example.invalid/v1', 'https://example.invalid/v1#fragment']
for (const [index, url] of rejectedUrls.entries()) {
  test(`refuses unsafe HTTPS case ${index + 1} before reading`, async t => {
    const { spec, observation } = fixture(t, 'process.stdin.resume()\n')
    spec.route.baseUrl = url
    spec.approval.subject.baseUrl = url
    await assert.rejects(invokePlannerOnce(spec), error => error instanceof PlannerInvocationError
      && error.code === 'PLANNER_TRANSPORT_NOT_PROVEN')
    assert.equal(observation.reads, 0)
  })
}

test('requires an explicit bounded termination grace before reading', async t => {
  const { spec, observation } = fixture(t, 'process.stdin.resume()\n')
  delete spec.process.terminationGraceMs
  await assert.rejects(invokePlannerOnce(spec), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_SPEC_INVALID')
  assert.equal(observation.reads, 0)
})

test('rejects NUL argv before reading rather than letting spawn reject after reading', async t => {
  const { spec, observation } = fixture(t, 'process.stdin.resume()\n')
  spec.cli.args.push('invalid\0argument')
  await assert.rejects(invokePlannerOnce(spec), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_SPEC_INVALID')
  assert.equal(observation.reads, 0)
})

test('captures a private input snapshot across asynchronous credential resolution', async t => {
  const { spec, observation } = fixture(t,
    "process.stdin.resume(); console.log(process.env.DSH_TEST_VALUE || 'original')\n")
  observation.onRead = () => {
    spec.cli.args.splice(0, spec.cli.args.length, '-e', "console.log('changed-argv')")
    spec.process.environment.DSH_TEST_VALUE = 'changed-environment'
  }
  const result = await invokePlannerOnce(spec)
  assert.equal(result.redactedStdout, 'original\n')
  assertBounded(result, 4096)
})

test('failed prompt delivery is not reported as a completed planning input', async t => {
  const { spec } = fixture(t, 'process.stdin.destroy(); process.exit(0)\n')
  writeFileSync(spec.prompt.file, Buffer.alloc(4 * 1024 * 1024, 65))
  spec.prompt.sha256 = digest(readFileSync(spec.prompt.file))
  const result = await invokePlannerOnce(spec)
  assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
  assert.equal(result.cancellationReason, 'INPUT_DELIVERY_FAILED')
  assertBounded(result, 4096)
})

test('deadline returns with an unverified descendant even when inherited pipes stay open', { timeout: 20000 }, async t => {
  const { directory, spec } = fixture(t, [
    "import { spawn } from 'node:child_process'",
    "const child = spawn(process.execPath, ['descendant.mjs'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })",
    "child.on('message', () => { process.stdin.resume(); process.exit(0) })",
  ].join('\n'))
  writeFileSync(join(directory, 'descendant.mjs'), [
    "import { existsSync, writeFileSync } from 'node:fs'",
    "writeFileSync('descendant.started', '')",
    "const done = () => { writeFileSync('descendant.exiting', ''); process.exit(0) }",
    "process.on('disconnect', () => {})",
    "process.send('ready')",
    "setInterval(() => { if (existsSync('descendant.stop')) done() }, 20)",
    'setTimeout(done, 6000)',
  ].join('\n'))
  spec.process.deadlineMs = 1000
  const result = await invokePlannerOnce(spec)
  assert.equal(existsSync(join(directory, 'descendant.started')), true)
  assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
  assert.equal(result.cancellationReason, 'DEADLINE_EXCEEDED')
  assert.equal(existsSync(join(directory, 'descendant.exiting')), false,
    'wrapper waited for the unrelated pipe holder instead of using the termination bound')
  assert.equal(result.cleanup.directChildExitObserved, true)
  assert.equal(result.cleanup.forcedPipeClosure, true)
  assert.equal(result.cleanup.descendantState, 'NOT_VERIFIED')
})

test('nonzero process completion retains the real exit and never accepts a product', async t => {
  const { spec } = fixture(t, 'process.stdin.resume(); process.stdin.on("end", () => { process.exitCode = 7 })\n')
  const result = await invokePlannerOnce(spec)
  assert.equal(result.status, 'PLANNER_INVOCATION_COMPLETED')
  assert.equal(result.exitCode, 7)
  assertBounded(result, 4096)
})


test('refuses case-insensitive credential environment collisions before reading', async t => {
  const { spec, observation } = fixture(t, 'process.stdin.resume()\n')
  spec.process.environment.dsh_synthetic_key = 'shadowing-value'
  await assert.rejects(invokePlannerOnce(spec), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_SPEC_INVALID')
  assert.equal(observation.reads, 0)
})

test('rejects a known leased key in argv before spawning and omits the value from errors', async t => {
  const { spec, directory, observation } = fixture(t,
    "import { writeFileSync } from 'node:fs'; writeFileSync('spawned', ''); process.stdin.resume()\n")
  spec.cli.args.push(key)
  await assert.rejects(invokePlannerOnce(spec), error => error.message === 'CREDENTIAL_OPERATION_FAILED'
    && !String(error).includes(key))
  assert.equal(observation.reads, 1)
  assert.equal(existsSync(join(directory, 'spawned')), false)
})
