import assert from 'node:assert/strict'
import { constants, createHash, createPublicKey, publicEncrypt } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

/** Descendant liveness proof that survives pid reuse in this busy runner. */
function descendantBeating(beatFile) {
  try {
    return Date.now() - statSync(beatFile).mtimeMs < 1000
  } catch {
    return false
  }
}

async function descendantTerminated(beatFile, waitMs) {
  const end = Date.now() + waitMs
  while (descendantBeating(beatFile) && Date.now() < end) await delay(50)
  return !descendantBeating(beatFile)
}

/** Shared synthetic descendant: files only, no inherited wrapper channels. */
function descendantProgram() {
  return [
    "import { existsSync, utimesSync, writeFileSync } from 'node:fs'",
    "writeFileSync('descendant.started', '')",
    "writeFileSync('descendant.pid', String(process.pid))",
    "const touch = () => { try { const now = new Date(); utimesSync('descendant.beat', now, now) } catch {} }",
    'touch()',
    "setInterval(touch, 100)",
    "const done = () => { writeFileSync('descendant.exiting', ''); process.exit(0) }",
    "setInterval(() => { if (existsSync('descendant.stop')) done() }, 20)",
    'setTimeout(done, 8000)',
  ].join('\n')
}

function fixture(t, program) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh861-planner-bounds-'))
  const startedFile = join(directory, 'descendant.started')
  const exitingFile = join(directory, 'descendant.exiting')
  const stopFile = join(directory, 'descendant.stop')
  const beatFile = join(directory, 'descendant.beat')
  t.after(async () => {
    if (existsSync(startedFile)) {
      writeFileSync(stopFile, '')
      const end = Date.now() + 5000
      // The descendant either acknowledges the stop file, or Windows already
      // terminated it in the job object closed when its spawner exited.
      while (descendantBeating(beatFile) && !existsSync(exitingFile) && Date.now() < end) await delay(20)
      assert.ok(existsSync(exitingFile) || !descendantBeating(beatFile),
        'owned descendant neither acknowledged cleanup nor exited')
    }
    // A just-terminated descendant releases its working directory asynchronously.
    const removeEnd = Date.now() + 2000
    for (;;) {
      try {
        rmSync(directory, { recursive: true, force: true })
        break
      } catch (error) {
        if (error?.code !== 'EPERM' || Date.now() > removeEnd) throw error
        await delay(50)
      }
    }
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
  // POSIX shares pipe file descriptors with descendants, so the direct child
  // can exit while a descendant still holds the wrapper's channels. Windows
  // terminates the whole spawn job when the direct child exits, so a descendant
  // cannot outlive it there; that branch instead keeps the direct child alive
  // past the deadline holding its own channels and still proves the bounded
  // return leaves the descendant unverified.
  const pipesSurviveChildExit = process.platform !== 'win32'
  const { directory, spec } = fixture(t, [
    "import { spawn } from 'node:child_process'",
    "import { existsSync } from 'node:fs'",
    "const child = spawn(process.execPath, ['descendant.mjs'], { stdio: ['ignore', 1, 2] })",
    "child.on('error', () => process.exit(1))",
    pipesSurviveChildExit
      ? "setInterval(() => { if (existsSync('descendant.started')) { process.stdin.resume(); process.exit(0) } }, 10)"
      : "setInterval(() => { if (existsSync('descendant.started')) process.stdin.resume() }, 10)",
  ].join('\n'))
  writeFileSync(join(directory, 'descendant.mjs'), descendantProgram())
  spec.process.deadlineMs = pipesSurviveChildExit ? 1000 : 5000
  const result = await invokePlannerOnce(spec)
  assert.equal(existsSync(join(directory, 'descendant.started')), true)
  assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
  assert.equal(result.cancellationReason, 'DEADLINE_EXCEEDED')
  assert.equal(existsSync(join(directory, 'descendant.exiting')), false,
    'wrapper waited for the unrelated pipe holder instead of using the termination bound')
  assert.equal(result.cleanup.directChildExitObserved, true)
  if (pipesSurviveChildExit) assert.equal(result.cleanup.forcedPipeClosure, true)
  assert.equal(result.cleanup.descendantState, 'NOT_VERIFIED')
})

test('normal completion leaves a non-pipe-holding descendant unverified', { timeout: 20000 }, async t => {
  // The direct child exits voluntarily once the descendant has started. POSIX
  // then leaves that descendant running past the wrapper's completed return;
  // Windows terminates it in the job object closed at the direct child's exit.
  // The wrapper observes neither, so its descendant state stays NOT_VERIFIED.
  const { directory, spec } = fixture(t, [
    "import { spawn } from 'node:child_process'",
    "import { existsSync } from 'node:fs'",
    "const child = spawn(process.execPath, ['descendant.mjs'], { stdio: 'ignore' })",
    "child.on('error', () => process.exit(1))",
    "child.unref()",
    "setInterval(() => { if (existsSync('descendant.started')) { process.stdin.resume(); process.exit(0) } }, 10)",
  ].join('\n'))
  writeFileSync(join(directory, 'descendant.mjs'), descendantProgram())
  const result = await invokePlannerOnce(spec)
  assert.equal(result.status, 'PLANNER_INVOCATION_COMPLETED')
  assert.equal(result.exitCode, 0)
  assert.equal(result.captureComplete, true)
  assert.equal(result.cleanup.descendantState, 'NOT_VERIFIED')
  const beatFile = join(directory, 'descendant.beat')
  if (process.platform === 'win32') {
    assert.ok(await descendantTerminated(beatFile, 2000),
      'Windows job object did not terminate the descendant at the direct child exit')
  } else {
    assert.equal(descendantBeating(beatFile), true,
      'wrapper or the platform terminated a descendant the wrapper never verified')
  }
})

test('cancelling one invocation leaves a concurrent unrelated invocation intact', { timeout: 20000 }, async t => {
  const stalled = fixture(t, 'setInterval(() => {}, 100)\n')
  stalled.spec.process.deadlineMs = 800
  const quick = fixture(t, 'process.stdin.resume()\n')
  const [cancelled, completed] = await Promise.all([
    invokePlannerOnce(stalled.spec),
    invokePlannerOnce(quick.spec),
  ])
  assert.equal(cancelled.status, 'PLANNER_INVOCATION_CANCELLED')
  assert.equal(cancelled.cancellationReason, 'DEADLINE_EXCEEDED')
  assert.equal(completed.status, 'PLANNER_INVOCATION_COMPLETED')
  assert.equal(completed.exitCode, 0)
  assert.equal(completed.cleanup.descendantState, 'NOT_VERIFIED')
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
