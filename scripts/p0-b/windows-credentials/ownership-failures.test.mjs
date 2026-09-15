import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { PassThrough, Writable } from 'node:stream'
import { setImmediate as tick } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from '@typescript/typescript6'

// Actual source modules with explicitly simulated process/OS boundaries. These
// tests prove failure-state handling, not Windows jobs, credentials or a model.
// Run: node --experimental-vm-modules --test <this file>
const root = dirname(fileURLToPath(import.meta.url))
const fixedBytes = Buffer.from('synthetic pinned input')
const sha = createHash('sha256').update(fixedBytes).digest('hex')
const quiet = () => {}
function deferred() {
  let resolvePromise, rejectPromise
  const promise = new Promise((resolve_, reject_) => { resolvePromise = resolve_; rejectPromise = reject_ })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}
async function load(name, overrides) {
  const context = vm.createContext({ Buffer, Uint8Array, URL, URLSearchParams, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, process: { platform: 'win32' }, console: { log: quiet, error: quiet } })
  const modules = new Map()
  async function moduleFor(id, exports) {
    if (modules.has(id)) return modules.get(id)
    const module = exports
      ? new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
      }, { context, identifier: id })
      : new vm.SourceTextModule(ts.transpileModule(await readFile(id, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: id,
      }).outputText, { context, identifier: id })
    modules.set(id, module)
    await module.link(async (specifier, parent) => {
      if (Object.hasOwn(overrides, specifier)) return moduleFor(`mock:${specifier}`, overrides[specifier])
      if (specifier.startsWith('node:')) return moduleFor(specifier, await import(specifier))
      return moduleFor(resolve(dirname(parent.identifier), specifier))
    })
    return module
  }
  const main = await moduleFor(resolve(root, name))
  await main.evaluate()
  return main.namespace
}
function fakeChild(onRequest = quiet) {
  const child = new EventEmitter()
  child.pid = 123456
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.input = []
  child.kills = []
  child.closed = false
  child.killed = deferred()
  child.stdin = new Writable({ write(chunk, _encoding, callback) {
    child.input.push(Buffer.from(chunk))
    onRequest(chunk.toString(), child)
    callback()
  } })
  child.kill = signal => { child.kills.push(signal); child.killed.resolve(); return true }
  child.unref = quiet
  child.close = (code = 0) => {
    if (child.closed) return
    child.closed = true
    child.emit('exit', code, null)
    child.stdout.end()
    child.stderr.end()
    child.emit('close', code, null)
  }
  child.reply = value => child.stdout.write(`${JSON.stringify(value)}\n`)
  return child
}
const fakeFiles = { readFile: async () => fixedBytes, realpath: async path => path }
async function invocationFixture(t, owner) {
  const child = fakeChild()
  const spawned = deferred()
  const api = await load('planner-invocation.ts', {
    'node:fs/promises': fakeFiles,
    'node:child_process': { spawn: () => { spawned.resolve(); return child } },
    './reader.ts': { createSealedCredentialReaders: () => ({ readEnv: () => undefined,
      readSecret: async () => 'SYNTHETIC-OWNERSHIP-KEY-ONLY' }) },
  })
  const route = { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
    baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' }
  const spec = {
    approval: { record: 'synthetic-only', transportEvidenceRecord: 'synthetic-only',
      subject: { agent: 'codex', model: route.model, reasoningEffort: route.reasoningEffort, baseUrl: route.baseUrl } },
    route, prompt: { file: '/synthetic/prompt', sha256: sha },
    cli: { executable: '/synthetic/cli', sha256: sha, args: [] }, bridge: quiet,
    process: { workingDirectory: '/synthetic', environment: {}, credentialEnvironmentVariable: 'DSH_SYNTHETIC_KEY',
      deadlineMs: 1000, terminationGraceMs: 100, maxChannelBytes: 1024,
      ...(owner ? { ownership: owner } : {}) },
    redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 },
  }
  t.after(() => { child.close(); child.stdin.destroy() })
  return { child, spec, spawned, run: () => api.invokePlannerOnce(spec) }
}
for (const kind of ['false', 'rejected', 'synchronous throw']) {
  test(`ownership ${kind} never delivers the pinned prompt`, async t => {
    const assignment = deferred()
    const owner = { assign: kind === 'synchronous throw' ? () => { throw new Error('synthetic') } : () => assignment.promise,
      terminateOwned: async () => true }
    const f = await invocationFixture(t, owner)
    const run = f.run()
    // Attach a rejection observer even for the old synchronous-throw defect.
    run.catch(quiet)
    await f.spawned.promise
    if (kind === 'false') assignment.resolve(false)
    if (kind === 'rejected') assignment.reject(new Error('synthetic'))
    await tick()
    const sent = Buffer.concat(f.child.input).length
    f.child.close()
    const result = await run
    assert.equal(sent, 0, 'unassigned process received input')
    assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
    assert.equal(result.cancellationReason, 'OWNERSHIP_FAILED')
  })
}
test('ownership success after deadline cannot deliver input', async t => {
  const assignment = deferred()
  const f = await invocationFixture(t, { assign: () => assignment.promise, terminateOwned: async () => true })
  f.spec.process.deadlineMs = 20
  const run = f.run()
  await f.child.killed.promise
  assignment.resolve(true)
  await tick()
  const sent = Buffer.concat(f.child.input).length
  f.child.close()
  assert.equal((await run).cancellationReason, 'DEADLINE_EXCEEDED')
  assert.equal(sent, 0)
})
test('exit before ownership settles cannot report completed input', async t => {
  const assignment = deferred()
  const f = await invocationFixture(t, { assign: () => assignment.promise, terminateOwned: async () => true })
  const run = f.run()
  await f.spawned.promise
  f.child.close()
  const result = await run
  assignment.resolve(false)
  await tick()
  assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
  assert.equal(result.cancellationReason, 'OWNERSHIP_FAILED')
  assert.equal(Buffer.concat(f.child.input).length, 0)
})
test('confirmed ownership delivers once and preserves ordinary completion', async t => {
  const f = await invocationFixture(t, { assign: async () => true, terminateOwned: async () => true })
  const run = f.run()
  await f.spawned.promise
  await tick()
  assert.deepEqual(Buffer.concat(f.child.input), fixedBytes)
  f.child.close()
  assert.equal((await run).status, 'PLANNER_INVOCATION_COMPLETED')
})
test('throwing termination callback cannot break bounded cancellation', async t => {
  const f = await invocationFixture(t, { assign: async () => true,
    terminateOwned: () => { throw new Error('synthetic') } })
  const run = f.run()
  run.catch(quiet)
  await f.spawned.promise
  await tick()
  f.child.stdout.emit('error', new Error('synthetic'))
  f.child.close()
  assert.equal((await run).status, 'PLANNER_INVOCATION_CANCELLED')
})

async function ownerFixture(t, respond) {
  let statusCount = 0
  const child = fakeChild((line, peer) => {
    const request = JSON.parse(line)
    if (request.op === 'status' && statusCount++ === 0) peer.reply({ ok: true, created: false, active: 0 })
    else respond(request, peer)
  })
  const api = await load('windows-job-owner.ts', {
    'node:child_process': { spawn: () => child }, 'node:fs/promises': fakeFiles,
  })
  const owner = await api.createProcessJobOwner({ powershellExecutable: '/synthetic/powershell', directory: '/synthetic',
    sha256: { executable: sha, helper: sha, launcher: sha }, environment: { SystemRoot: '/synthetic', TEMP: '/tmp', TMP: '/tmp' },
    replyTimeoutMs: 80 })
  t.after(() => { child.close(); child.stdin.destroy() })
  return { child, owner }
}
for (const op of ['assign', 'terminate']) {
  test(`owner ${op} rejects contradictory ok=false success fields`, async t => {
    const f = await ownerFixture(t, (_request, peer) => peer.reply({ ok: false,
      [op === 'assign' ? 'assigned' : 'terminated']: true, code: 'OWNER_SYNTHETIC_FAILURE' }))
    assert.equal(await (op === 'assign' ? f.owner.assign(123) : f.owner.terminateOwned()), false)
  })
}
test('negative active count is invalid evidence, not a valid count', async t => {
  const f = await ownerFixture(t, (_request, peer) => peer.reply({ ok: true, created: true, active: -2 }))
  assert.equal(await f.owner.activeProcesses(), -1)
})
test('owner protocol refuses oversized incomplete output immediately', async t => {
  const f = await ownerFixture(t, () => {})
  const operation = f.owner.activeProcesses()
  f.child.stdout.write(' '.repeat(4097))
  const killedBeforeTimeout = f.child.kills.length > 0
  f.child.close(1)
  await operation
  assert.equal(killedBeforeTimeout, true)
})
test('dispose waits for observed helper close, not just an acknowledgement', async t => {
  const f = await ownerFixture(t, (request, peer) => {
    if (request.op === 'dispose') peer.reply({ ok: true, disposed: true })
  })
  let completed = false
  const operation = f.owner.dispose().then(() => { completed = true })
  await tick()
  const early = completed
  f.child.close()
  await operation
  assert.equal(early, false)
})
test('dispose rejects a helper that acknowledges but does not exit', async t => {
  const f = await ownerFixture(t, (_request, peer) => peer.reply({ ok: true, disposed: true }))
  await assert.rejects(f.owner.dispose(), /OWNER_REPLY_TIMEOUT/)
})
test('failed disposal reply cannot resolve as successful cleanup', async t => {
  const f = await ownerFixture(t, (_request, peer) => peer.reply({ ok: false, code: 'OWNER_DISPOSE_FAILED' }))
  await assert.rejects(f.owner.dispose(), /OWNER_PROTOCOL_INVALID/)
})
test('prior protocol failure cannot make later disposal report success', async t => {
  const f = await ownerFixture(t, () => {})
  f.child.close(1)
  await assert.rejects(f.owner.dispose(), /OWNER_PROTOCOL_INVALID/)
})
test('a valid dispose acknowledgement and clean close allow idempotent disposal', async t => {
  const f = await ownerFixture(t, (_request, peer) => {
    peer.reply({ ok: true, disposed: true })
    setImmediate(() => peer.close())
  })
  await f.owner.dispose()
  await f.owner.dispose()
  assert.equal(f.child.input.filter(bytes => JSON.parse(bytes).op === 'dispose').length, 1)
})

test('null protocol reply becomes a fixed error without escaping an event callback', async t => {
  const f = await ownerFixture(t, (_request, peer) => peer.reply(null))
  // The old implementation resolves null into the request; all methods still
  // return refusal values, but disposal must not hide the protocol failure.
  assert.equal(await f.owner.activeProcesses(), -1)
  await assert.rejects(f.owner.dispose(), /OWNER_PROTOCOL_INVALID/)
})

async function entryFixture(t, settings = {}) {
  const events = []
  const invocation = {
    status: 'PLANNER_INVOCATION_COMPLETED', exitCode: 0, signal: null,
    ownership: { assignmentRequested: true, assigned: true, terminationRequested: false },
    secretLeakDetected: false, captureComplete: true,
  }
  const owner = {
    assign: async () => true,
    terminateOwned: async () => { events.push('terminate'); return settings.terminated ?? true },
    activeProcesses: async () => settings.active ?? 0,
    dispose: async () => { events.push('dispose'); if (settings.disposeFails) throw new Error('synthetic') },
  }
  const route = { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max', baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' }
  const projection = { route, runRoot: '/synthetic/run', configFile: '/synthetic/run/codex-home/config.toml',
    configToml: '', executable: '/synthetic/cli', executableSha256: sha, args: [], workingDirectory: '/synthetic/work',
    environment: {}, credentialEnvironmentVariable: 'DSH_SYNTHETIC_KEY', publicConfigSha256: sha }
  const api = await load('planner-entry.ts', {
    'node:fs/promises': { mkdir: async (path, options) => {
      events.push(`mkdir:${path}`)
      if (settings.rootExists && path === projection.runRoot && !options?.recursive) throw new Error('EEXIST')
    }, writeFile: async () => { events.push('write') } },
    './codex-launch-projection.mjs': { projectCodexLaunch: () => projection },
    './windows-job-owner.ts': { createProcessJobOwner: async () => owner,
      ProcessJobOwnerError: class extends Error {} },
    './planner-invocation.ts': { invokePlannerOnce: async () => {
      events.push('invoke')
      if (settings.invokeFails) throw new Error('synthetic')
      return invocation
    }, PlannerInvocationError: class extends Error {} },
  })
  t.after(() => {})
  const spec = { configuration: {}, trustedLock: {}, input: { toolDirectories: [], platform: 'win32' },
    approval: { record: 'synthetic-only', transportEvidenceRecord: 'synthetic-only',
      subject: { agent: 'codex', model: route.model, reasoningEffort: route.reasoningEffort, baseUrl: route.baseUrl } },
    prompt: { file: '/synthetic/prompt', sha256: sha }, bridge: quiet,
    bounds: { deadlineMs: 1000, terminationGraceMs: 100, maxChannelBytes: 1024, redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 } },
    jobOwner: { sha256: {}, environment: {} } }
  return { events, invocation, spec, run: () => api.invokeProjectedPlannerOnce(spec) }
}
for (const [name, settings] of [['termination refused', { terminated: false }], ['members remain', { active: 2 }],
  ['count unknown', { active: -1 }], ['disposal failed', { disposeFails: true }]]) {
  test(`entry cannot label ${name} as completed cleanup`, async t => {
    const f = await entryFixture(t, settings)
    const result = await f.run()
    assert.equal(result.status, 'PROJECTED_PLANNER_CLEANUP_BLOCKED')
    assert.equal(result.productAccepted, false)
  })
}
test('entry preserves cleanup facts when invocation throws', async t => {
  const f = await entryFixture(t, { invokeFails: true, disposeFails: true })
  const result = await f.run()
  assert.equal(result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.ok(result.ownership, 'refusal erased cleanup receipt')
  assert.equal(result.ownership.disposed, false)
  assert.ok(f.events.includes('terminate'))
})
test('entry reserves a fresh run root before creating children', async t => {
  const f = await entryFixture(t, { rootExists: true })
  const result = await f.run()
  assert.equal(result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(result.code, 'PROJECTED_PLANNER_RUNROOT_UNAVAILABLE')
  assert.equal(f.events.includes('write'), false)
  assert.equal(f.events.includes('invoke'), false)
})
test('missing approval references refuse before materialization', async t => {
  const f = await entryFixture(t)
  f.spec.approval.record = ''
  const result = await f.run()
  assert.equal(result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(f.events.length, 0)
})
test('entry returns completed only with observed assigned and empty disposed job', async t => {
  const f = await entryFixture(t)
  const result = await f.run()
  assert.equal(result.status, 'PROJECTED_PLANNER_COMPLETED')
  assert.equal(result.ownership.disposed, true)
  assert.equal(result.ownership.activeProcessesRemaining, 0)
})
