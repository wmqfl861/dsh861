import assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { PassThrough, Writable } from 'node:stream'
import { setImmediate as tick } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// The entry and invocation are real source modules. Unit cases replace only
// their OS/credential peers. Windows cases retain real helpers, pipes and jobs;
// the spawn observer never substitutes a process or reconstructs the adapter.
const root = path.dirname(fileURLToPath(import.meta.url))
const sourceCache = new Map()
const core = { 'node:child_process': childProcess, 'node:crypto': crypto, 'node:fs': fs,
  'node:fs/promises': fsp, 'node:path': path }
const fixedInput = Buffer.from('synthetic entry input\n')
const sha = crypto.createHash('sha256').update(fixedInput).digest('hex')
const key = 'SYNTHETIC-ENTRY-WIRING-KEY-ONLY'
const quiet = () => {}
function deferred() {
  let resolve
  const promise = new Promise(resolve_ => { resolve = resolve_ })
  return { promise, resolve }
}
async function loadEntry(overrides, processObject) {
  const context = vm.createContext({ Buffer, Uint8Array, URL, URLSearchParams,
    setTimeout, clearTimeout, process: processObject })
  const modules = new Map()
  function moduleFor(id, exports) {
    if (modules.has(id)) return modules.get(id)
    const pending = (async () => {
      if (exports) {
        return new vm.SyntheticModule(Object.keys(exports), function () {
          for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
        }, { context, identifier: id })
      }
      if (!sourceCache.has(id)) {
        const source = await fsp.readFile(id, 'utf8')
        sourceCache.set(id, id.endsWith('.ts') ? ts.transpileModule(source, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: id,
        }).outputText : source)
      }
      return new vm.SourceTextModule(sourceCache.get(id), { context, identifier: id,
        initializeImportMeta(meta) { meta.url = pathToFileURL(id).href } })
    })()
    modules.set(id, pending)
    return pending
  }
  const entry = await moduleFor(path.join(root, 'planner-entry.ts'))
  await entry.link(async (name, parent) => {
    if (Object.hasOwn(overrides, name)) return moduleFor(`peer:${name}`, overrides[name])
    if (name.startsWith('node:')) return moduleFor(name, core[name] ?? await import(name))
    return moduleFor(path.resolve(path.dirname(parent.identifier), name))
  })
  await entry.evaluate()
  return entry.namespace.invokeProjectedPlannerOnce
}
function unitFixture(t, mode = 'success') {
  const trace = [], children = [], enteredAssignment = deferred(), assignment = deferred(), killed = deferred()
  let targetStarted = false, bareSpawns = 0, launcher, releaseFailed = false
  function processPeer() {
    const child = new EventEmitter()
    child.pid = 51000 + children.length
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.closed = false
    child.input = []
    child.close = () => {
      if (child.closed) return
      child.closed = true
      child.emit('exit', 0, null)
      child.stdout.end(); child.stderr.end()
      child.emit('close', 0, null)
    }
    child.stdin = new Writable({ write(bytes, _encoding, callback) { child.input.push(Buffer.from(bytes)); callback() },
      final(callback) {
        trace.push('input')
        child.stdout.write('synthetic target completed\n')
        callback(); setImmediate(child.close)
      } })
    child.kill = () => { killed.resolve(); setImmediate(child.close); return true }
    child.unref = quiet
    children.push(child)
    return child
  }
  const owner = {
    launchGated(request) {
      assert.equal(this, owner)
      trace.push('launchGated')
      assert.deepEqual([...request.args], ['exec', '--sandbox', 'read-only', '-'])
      assert.equal(request.environment.DSH_SYNTHETIC_KEY, key)
      if (mode === 'launch-throws') throw new Error('synthetic launcher failure')
      launcher = processPeer()
      return launcher
    },
    async assign(pid) {
      assert.equal(this, owner)
      trace.push('assign')
      enteredAssignment.resolve()
      if (mode === 'late') return assignment.promise
      if (mode === 'assign-rejects') throw new Error('synthetic assignment failure')
      return mode !== 'assign-false'
    },
    releaseGated() {
      assert.equal(this, owner)
      trace.push('releaseGated')
      if (mode === 'release-throws') { releaseFailed = true; throw new Error('synthetic release failure') }
      targetStarted = true
    },
    abortGated() { assert.equal(this, owner); trace.push('abortGated') },
    async terminateOwned() { assert.equal(this, owner); trace.push('terminate'); return true },
    async activeProcesses() { return 0 },
    async dispose() { trace.push('dispose') },
  }
  const route = { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
    baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' }
  const projection = { route, runRoot: '/synthetic/run', configFile: '/synthetic/run/codex-home/config.toml',
    configToml: '', executable: '/synthetic/cli', executableSha256: sha,
    args: ['exec', '--sandbox', 'read-only', '-'], workingDirectory: '/synthetic/work',
    environment: {}, credentialEnvironmentVariable: 'DSH_SYNTHETIC_KEY', publicConfigSha256: sha }
  const spec = { configuration: {}, trustedLock: {}, input: { platform: 'win32', toolDirectories: [] },
    approval: { record: 'synthetic-only', transportEvidenceRecord: 'synthetic-only',
      subject: { agent: 'codex', model: route.model, reasoningEffort: route.reasoningEffort, baseUrl: route.baseUrl } },
    prompt: { file: '/synthetic/prompt', sha256: sha }, bridge: quiet,
    bounds: { deadlineMs: mode === 'late' ? 30 : 1000, terminationGraceMs: 100, maxChannelBytes: 4096,
      redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 } }, jobOwner: { sha256: {}, environment: {} } }
  const overrides = {
    'node:fs/promises': { mkdir: async () => {}, writeFile: async () => {}, readFile: async () => fixedInput },
    'node:child_process': { spawn() { bareSpawns++; targetStarted = true; return processPeer() } },
    './codex-launch-projection.mjs': { projectCodexLaunch: () => projection },
    './windows-job-owner.ts': { createProcessJobOwner: async () => owner, ProcessJobOwnerError: class extends Error {} },
    './reader.ts': { createSealedCredentialReaders: () => ({ readEnv: () => undefined, readSecret: async () => key }) },
  }
  t.after(() => { for (const child of children) { child.close(); child.stdin.destroy() } })
  return { trace, enteredAssignment, assignment, killed,
    observe: () => ({ bareSpawns, targetStarted, releaseFailed, inputBytes: children.reduce((n, c) => n + Buffer.concat(c.input).length, 0) }),
    run: async () => (await loadEntry(overrides, { platform: 'win32' }))(spec) }
}

test('projected entry invokes the owned launcher before assign, release and prompt delivery', async t => {
  const fixture = unitFixture(t)
  const result = await fixture.run()
  assert.equal(fixture.observe().bareSpawns, 0, 'projected entry fell back to a bare CLI spawn')
  assert.deepEqual(fixture.trace.slice(0, 4), ['launchGated', 'assign', 'releaseGated', 'input'])
  assert.equal(fixture.observe().targetStarted, true)
  assert.equal(result.status, 'PROJECTED_PLANNER_COMPLETED')
  assert.equal(result.invocation.redactedStdout, 'synthetic target completed\n')
  assert.equal(result.productAccepted, false)
})
for (const mode of ['assign-false', 'assign-rejects']) {
  test(`projected entry ${mode} aborts its actual gate without starting a target`, async t => {
    const fixture = unitFixture(t, mode)
    const result = await fixture.run()
    assert.equal(fixture.observe().bareSpawns, 0)
    assert.equal(fixture.observe().targetStarted, false)
    assert.equal(fixture.observe().inputBytes, 0)
    assert.ok(fixture.trace.includes('abortGated'))
    assert.equal(fixture.trace.includes('releaseGated'), false)
    assert.equal(result.invocation.cancellationReason, 'OWNERSHIP_FAILED')
    assert.equal(result.status, 'PROJECTED_PLANNER_CLEANUP_BLOCKED')
  })
}
test('projected entry does not turn a gate release failure into a completed bare run', async t => {
  const fixture = unitFixture(t, 'release-throws')
  const result = await fixture.run()
  assert.equal(fixture.observe().bareSpawns, 0)
  assert.equal(fixture.observe().releaseFailed, true)
  assert.equal(fixture.observe().targetStarted, false)
  assert.equal(fixture.observe().inputBytes, 0)
  assert.equal(result.invocation.cancellationReason, 'OWNERSHIP_FAILED')
  assert.equal(result.status, 'PROJECTED_PLANNER_CANCELLED')
})
test('projected entry cannot release a gate after the invocation deadline', async t => {
  const fixture = unitFixture(t, 'late')
  const running = fixture.run()
  await fixture.enteredAssignment.promise
  await fixture.killed.promise
  fixture.assignment.resolve(true)
  await tick()
  const result = await running
  assert.equal(fixture.observe().bareSpawns, 0)
  assert.equal(fixture.observe().targetStarted, false)
  assert.equal(fixture.observe().inputBytes, 0)
  assert.ok(fixture.trace.includes('abortGated'))
  assert.equal(fixture.trace.includes('releaseGated'), false)
  assert.equal(result.invocation.cancellationReason, 'DEADLINE_EXCEEDED')
})
test('projected entry preserves launcher failure rather than using bare spawn', async t => {
  const fixture = unitFixture(t, 'launch-throws')
  const result = await fixture.run()
  assert.equal(fixture.observe().bareSpawns, 0)
  assert.deepEqual(fixture.trace, ['launchGated', 'terminate', 'dispose'])
  assert.equal(result.invocation.cancellationReason, 'SPAWN_ERROR')
  assert.equal(result.status, 'PROJECTED_PLANNER_CLEANUP_BLOCKED')
})

// The native consumer tests do not hand-build an ownership adapter. Only host
// spawn is observed: the gate spawns the CLI in a different process, so a bare
// CLI launch from the entry is directly detectable even if a fast assign wins.
for (const stalled of [false, true]) {
  test(`native projected entry uses the pinned launcher for ${stalled ? 'cancellation' : 'completion'}`, {
    skip: process.platform !== 'win32', timeout: 90000,
  }, async t => {
    const base = fs.mkdtempSync(path.join(tmpdir(), 'dsh861-entry-gate-'))
    const workspace = path.join(base, 'workspace'), runRoot = path.join(base, 'run')
    fs.mkdirSync(workspace)
    const promptFile = path.join(base, 'prompt.txt')
    fs.writeFileSync(promptFile, fixedInput)
    fs.writeFileSync(path.join(workspace, 'exec'), [
      "const { writeFileSync } = require('node:fs')",
      "writeFileSync('target-started.json', JSON.stringify({ pid: process.pid, ppid: process.ppid }))",
      "process.stdin.resume()",
      stalled ? "setInterval(() => {}, 100)" : "process.stdin.on('end', () => { console.log('synthetic-complete') })",
    ].join('\n'))
    const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    const repository = path.resolve(root, '../../..')
    const configuration = JSON.parse(fs.readFileSync(path.join(repository, 'config/agents/models.v1.json'), 'utf8'))
    const lock = JSON.parse(fs.readFileSync(path.join(repository, 'config/agents/models.v1.lock.json'), 'utf8'))
    configuration.agents.codex.baseUrl = 'https://approved.example.invalid/v1'
    const { publicConfigDigest } = await import('../model-config.mjs')
    lock.publicConfigSha256 = publicConfigDigest(configuration)
    const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const children = []
    const observedSpawn = (executable, args, options) => {
      const child = childProcess.spawn(executable, args, options)
      const item = { child, executable, args, closed: false, close: undefined }
      item.close = new Promise(resolve => child.once('close', () => { item.closed = true; resolve() }))
      children.push(item)
      return child
    }
    t.after(async () => {
      for (const item of children) if (!item.closed) item.child.kill('SIGKILL')
      for (const item of children) {
        let timer
        try {
          await Promise.race([item.close, new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('test-owned child did not close')), 10000)
          })])
        } finally { clearTimeout(timer) }
      }
      fs.rmSync(base, { recursive: true, force: true })
    })
    const entry = await loadEntry({
      'node:child_process': { ...childProcess, spawn: observedSpawn },
      './reader.ts': { createSealedCredentialReaders: () => ({ readEnv: () => undefined, readSecret: async () => key }) },
    }, process)
    const result = await entry({ configuration, trustedLock: lock,
      input: { platform: 'win32', workspace, runRoot, executable: process.execPath, executableSha256: digest(process.execPath),
        systemRoot: process.env.SystemRoot, toolDirectories: [path.join(process.env.SystemRoot, 'System32')] },
      approval: { record: 'synthetic-only', transportEvidenceRecord: 'synthetic-only',
        subject: { agent: 'codex', model: configuration.agents.codex.model,
          reasoningEffort: configuration.agents.codex.reasoningEffort, baseUrl: configuration.agents.codex.baseUrl } },
      prompt: { file: promptFile, sha256: digest(promptFile) }, bridge: quiet,
      bounds: { deadlineMs: stalled ? 5000 : 20000, terminationGraceMs: 1000, maxChannelBytes: 4096,
        redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 } },
      jobOwner: { powershellExecutable: powershell, directory: root,
        sha256: { executable: digest(powershell), helper: digest(path.join(root, 'job-owner.ps1')),
          launcher: digest(path.join(root, 'launch-gate.mjs')) },
        environment: { SystemRoot: process.env.SystemRoot, TEMP: base, TMP: base }, replyTimeoutMs: 20000 },
    })
    assert.equal(children.length, 2, 'entry must directly start only the helper and gate')
    assert.equal(children[0].executable, powershell)
    assert.equal(children[1].executable, process.execPath)
    assert.equal(children[1].args[0], path.join(root, 'launch-gate.mjs'), 'entry bypassed the pinned gate')
    const target = JSON.parse(fs.readFileSync(path.join(workspace, 'target-started.json'), 'utf8'))
    assert.ok(Number.isSafeInteger(target.pid) && target.pid > 0)
    assert.equal(target.ppid, children[1].child.pid, 'target was not created by the observed gate')
    assert.equal(result.status, stalled ? 'PROJECTED_PLANNER_CANCELLED' : 'PROJECTED_PLANNER_COMPLETED')
    assert.equal(result.ownership.assigned, true)
    assert.equal(result.ownership.activeProcessesRemaining, 0)
    assert.equal(result.ownership.disposed, true)
    assert.equal(result.productAccepted, false)
  })
}
