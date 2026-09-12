import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { constants, createHash, createPublicKey, publicEncrypt } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolveApprovedRoute } from '../model-config.mjs'
import { invokePlannerOnce, PlannerInvocationError } from './planner-invocation.ts'

// Keyless synthetic-process verification of the planner wiring. No real credential
// target is read (the bridge is a test double), no model endpoint is contacted,
// and the spawned process is a Node script standing in for the planner CLI.
const sentinel = 'SYNTHETIC-PLANNER-KEY-4b7e02'
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const root = dirname(fileURLToPath(import.meta.url))

function sealedPacket(request, value) {
  const key = createPublicKey({ format: 'jwk', key: { kty: 'RSA',
    n: Buffer.from(request.modulus, 'base64').toString('base64url'),
    e: Buffer.from(request.exponent, 'base64').toString('base64url') } })
  const ciphertext = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(value)).toString('base64')
  return Buffer.from(JSON.stringify({ version: 1, requestId: request.requestId, status: 'SEALED',
    ciphertext, selfTestRemoved: false }))
}

function fakeBridge(value = sentinel) {
  const observation = { calls: 0 }
  const invoke = async (action, provider, requestBytes) => {
    observation.calls++
    assert.equal(action, 'Read')
    assert.equal(provider, 'codex')
    return sealedPacket(JSON.parse(requestBytes.toString()), value)
  }
  return { observation, invoke }
}

const httpsRoute = { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
  baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' }

function baseSpec(bridge, overrides = {}) {
  return {
    approval: { record: 'owner-record-placeholder', transportEvidenceRecord: 'transport-record-placeholder',
      subject: { agent: 'codex', model: 'gpt-6-astra', reasoningEffort: 'max',
        baseUrl: httpsRoute.baseUrl } },
    route: httpsRoute,
    prompt: { file: join(root, 'README.md'), sha256: hash(join(root, 'README.md')) },
    cli: { executable: process.execPath, sha256: hash(process.execPath), args: [] },
    bridge,
    process: { workingDirectory: root, environment: {},
      credentialEnvironmentVariable: 'DSH_SYNTHETIC_CODEX_KEY',
      deadlineMs: 30000, terminationGraceMs: 300, maxChannelBytes: 65536 },
    redactionLimits: { maxSecrets: 4, maxSecretBytes: 384 },
    ...overrides,
  }
}

test('refuses the current approved HTTP route before any credential read', async () => {
  const repository = resolve(root, '../../..')
  const config = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.json'), 'utf8'))
  const lock = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.lock.json'), 'utf8'))
  const route = resolveApprovedRoute(config, lock, 'codex')
  assert.equal(route.baseUrl.startsWith('http://'), true)
  const fake = fakeBridge()
  await assert.rejects(invokePlannerOnce(baseSpec(fake.invoke, {
    route,
    approval: { record: 'owner-record-placeholder', transportEvidenceRecord: 'transport-record-placeholder',
      subject: { agent: 'codex', model: route.model, reasoningEffort: route.reasoningEffort,
        baseUrl: route.baseUrl } },
  })), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_TRANSPORT_NOT_PROVEN')
  assert.equal(fake.observation.calls, 0)
})

test('refuses a subject that does not match the approval before any credential read', async () => {
  const fake = fakeBridge()
  await assert.rejects(invokePlannerOnce(baseSpec(fake.invoke, {
    route: { ...httpsRoute, model: 'some-other-model' },
  })), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_SUBJECT_NOT_APPROVED')
  assert.equal(fake.observation.calls, 0)
})

test('refuses an approval without an owner record before any credential read', async () => {
  const fake = fakeBridge()
  await assert.rejects(invokePlannerOnce(baseSpec(fake.invoke, {
    approval: { record: '', transportEvidenceRecord: 'transport-record-placeholder',
      subject: { agent: 'codex', model: 'gpt-6-astra', reasoningEffort: 'max',
        baseUrl: httpsRoute.baseUrl } },
  })), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_APPROVAL_INVALID')
  assert.equal(fake.observation.calls, 0)
})

test('refuses a prompt whose bytes do not match the pinned hash', async () => {
  const fake = fakeBridge()
  await assert.rejects(invokePlannerOnce(baseSpec(fake.invoke, {
    prompt: { file: join(root, 'README.md'), sha256: '0'.repeat(64) },
  })), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_INPUT_NOT_FIXED')
  assert.equal(fake.observation.calls, 0)
})

test('refuses a CLI executable whose bytes do not match the pinned hash', async () => {
  const fake = fakeBridge()
  await assert.rejects(invokePlannerOnce(baseSpec(fake.invoke, {
    cli: { executable: process.execPath, sha256: '0'.repeat(64), args: [] },
  })), error => error instanceof PlannerInvocationError
    && error.code === 'PLANNER_CLI_NOT_VERIFIED')
  assert.equal(fake.observation.calls, 0)
})

test('completes a synthetic run with the leased value redacted from every channel', {
  timeout: 60000,
}, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-planner-synth-'))
  try {
    const cli = join(temporary, 'fake-planner.mjs')
    writeFileSync(cli, [
      'const chunks = []',
      "process.stdin.on('data', chunk => chunks.push(chunk))",
      "process.stdin.on('end', () => {",
      "  console.log(JSON.stringify({ type: 'model_request', attempt: 1 }))",
      "  console.log(JSON.stringify({ type: 'model_request', attempt: 2 }))",
      "  console.log('credential echoed by synthetic peer: ' + process.env.DSH_SYNTHETIC_CODEX_KEY)",
      "  process.stderr.write('prompt bytes received: ' + Buffer.concat(chunks).length + '\\n')",
      '  process.exit(0)',
      '})',
      '',
    ].join('\n'))
    const promptFile = join(temporary, 'plan-input.txt')
    writeFileSync(promptFile, 'fixed synthetic planning input\n')
    const fake = fakeBridge()
    const result = await invokePlannerOnce(baseSpec(fake.invoke, {
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [cli] },
      process: { workingDirectory: temporary, environment: {},
        credentialEnvironmentVariable: 'DSH_SYNTHETIC_CODEX_KEY',
        deadlineMs: 25000, terminationGraceMs: 300, maxChannelBytes: 65536 },
    }))
    assert.equal(fake.observation.calls, 1)
    assert.equal(result.status, 'PLANNER_INVOCATION_COMPLETED')
    assert.equal(result.exitCode, 0)
    assert.equal(result.signal, null)
    assert.equal(result.secretLeakDetected, true)
    assert.equal(result.redactedStdout.includes(sentinel), false)
    assert.match(result.redactedStdout, /\[SECRET_REDACTED\]/)
    assert.match(result.redactedStdout, /model_request/)
    assert.equal(result.redactedStderr.includes(sentinel), false)
    assert.equal(result.costModel, 'wall-clock-and-channel-bounded-not-per-request')
    assert.equal(result.productAccepted, false)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('cancels and kills the direct child when the deadline passes', {
  timeout: 60000,
}, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-planner-dead-'))
  try {
    const cli = join(temporary, 'sleeping-planner.mjs')
    writeFileSync(cli, 'setTimeout(() => process.exit(0), 30000)\n')
    const promptFile = join(temporary, 'plan-input.txt')
    writeFileSync(promptFile, 'fixed synthetic planning input\n')
    const fake = fakeBridge()
    const result = await invokePlannerOnce(baseSpec(fake.invoke, {
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [cli] },
      process: { workingDirectory: temporary, environment: {},
        credentialEnvironmentVariable: 'DSH_SYNTHETIC_CODEX_KEY',
        deadlineMs: 500, terminationGraceMs: 300, maxChannelBytes: 65536 },
    }))
    assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
    assert.equal(result.cancellationReason, 'DEADLINE_EXCEEDED')
    assert.equal(result.exitCode, null)
    assert.equal(result.redactedStdout.includes(sentinel), false)
    assert.equal(result.secretLeakDetected, false)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

/** Recording owner double: the launch/assign/release/abort order is the contract. */
function gatedOwner(events, spawnGate, assign) {
  return {
    launch: request => {
      events.push(['launch', request.executable, [...request.args], request.workingDirectory,
        Object.hasOwn(request.environment, 'DSH_SYNTHETIC_CODEX_KEY'), request.maxWaitMs])
      return spawnGate()
    },
    assign: async pid => { events.push(['assign', pid]); return assign() },
    release: () => { events.push(['release']) },
    abort: () => { events.push(['abort']) },
    terminateOwned: async () => { events.push(['terminate']); return true },
  }
}

test('a gated run releases the CLI only after membership and delivers the input then', {
  timeout: 60000,
}, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-planner-gate-'))
  try {
    const cli = join(temporary, 'gated-planner.mjs')
    writeFileSync(cli, [
      'const chunks = []',
      "process.stdin.on('data', chunk => chunks.push(chunk))",
      "process.stdin.on('end', () => {",
      "  process.stderr.write('gated input chunks: ' + chunks.length + '\\n')",
      '  process.exit(0)',
      '})',
      'setInterval(() => {}, 1000)',
      '',
    ].join('\n'))
    const promptFile = join(temporary, 'plan-input.txt')
    writeFileSync(promptFile, 'fixed synthetic planning input\n')
    const events = []
    const fake = fakeBridge()
    const result = await invokePlannerOnce(baseSpec(fake.invoke, {
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [cli] },
      process: { workingDirectory: temporary, environment: {},
        credentialEnvironmentVariable: 'DSH_SYNTHETIC_CODEX_KEY',
        deadlineMs: 5000, terminationGraceMs: 300, maxChannelBytes: 65536,
        ownership: gatedOwner(events,
          () => spawn(process.execPath, [cli], { cwd: temporary, stdio: ['pipe', 'pipe', 'pipe'] }),
          async () => { await delay(150); return true }) },
    }))
    assert.equal(result.status, 'PLANNER_INVOCATION_COMPLETED')
    assert.equal(result.exitCode, 0)
    assert.match(result.redactedStderr, /gated input chunks: 1/)
    const kinds = events.map(event => event[0])
    assert.equal(kinds.indexOf('release'), kinds.length - 1, 'release must be the final ownership step of a live run')
    assert.equal(kinds.includes('abort'), false)
    assert.equal(events[0][0], 'launch')
    assert.equal(events[0][1], process.execPath)
    assert.deepEqual(events[0][2], [cli])
    assert.equal(events[0][3], temporary)
    assert.equal(events[0][4], true, 'the leased credential environment must cross into the gate launch')
    assert.equal(events[0][5], 5000 + 300 + 10_000)
    assert.equal(result.ownership?.assigned, true)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('a gated run aborts the gate and never releases or delivers input without membership', {
  timeout: 60000,
}, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-planner-gate-refused-'))
  try {
    const cli = join(temporary, 'stalled-planner.mjs')
    writeFileSync(cli, 'setInterval(() => {}, 1000)\n')
    const promptFile = join(temporary, 'plan-input.txt')
    writeFileSync(promptFile, 'fixed synthetic planning input\n')
    const events = []
    const fake = fakeBridge()
    const result = await invokePlannerOnce(baseSpec(fake.invoke, {
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [cli] },
      process: { workingDirectory: temporary, environment: {},
        credentialEnvironmentVariable: 'DSH_SYNTHETIC_CODEX_KEY',
        deadlineMs: 4000, terminationGraceMs: 300, maxChannelBytes: 65536,
        ownership: gatedOwner(events,
          () => spawn(process.execPath, [cli], { cwd: temporary, stdio: ['pipe', 'pipe', 'pipe'] }),
          async () => false) },
    }))
    assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
    assert.equal(result.cancellationReason, 'OWNERSHIP_FAILED')
    const kinds = events.map(event => event[0])
    assert.equal(kinds.includes('release'), false, 'a refused assignment must never start the CLI')
    assert.equal(kinds.indexOf('abort'), kinds.length - 2, 'abort must precede the termination request')
    assert.equal(kinds[kinds.length - 1], 'terminate')
    assert.equal(result.ownership?.assigned, false)
    assert.equal(result.ownership?.terminationRequested, true)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('a late assignment after cancellation aborts the gate instead of starting the CLI', {
  timeout: 60000,
}, async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-planner-gate-late-'))
  try {
    const cli = join(temporary, 'stalled-planner.mjs')
    writeFileSync(cli, 'setInterval(() => {}, 1000)\n')
    const promptFile = join(temporary, 'plan-input.txt')
    writeFileSync(promptFile, 'fixed synthetic planning input\n')
    const events = []
    const fake = fakeBridge()
    const result = await invokePlannerOnce(baseSpec(fake.invoke, {
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [cli] },
      process: { workingDirectory: temporary, environment: {},
        credentialEnvironmentVariable: 'DSH_SYNTHETIC_CODEX_KEY',
        deadlineMs: 300, terminationGraceMs: 100, maxChannelBytes: 65536,
        ownership: gatedOwner(events,
          () => spawn(process.execPath, [cli], { cwd: temporary, stdio: ['pipe', 'pipe', 'pipe'] }),
          async () => { await delay(600); return true }) },
    }))
    await delay(500)
    assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
    assert.equal(result.cancellationReason, 'DEADLINE_EXCEEDED')
    const kinds = events.map(event => event[0])
    assert.equal(kinds.includes('release'), false, 'an assignment landing after cancellation must never start the CLI')
    assert.equal(kinds.includes('abort'), true)
    assert.equal(kinds.includes('terminate'), true)
    assert.equal(result.ownership?.assigned, false)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})
