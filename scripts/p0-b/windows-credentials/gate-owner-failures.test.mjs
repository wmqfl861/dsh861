import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import * as paths from 'node:path'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PassThrough, Writable } from 'node:stream'
import { setImmediate as tick } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from '@typescript/typescript6'

// Actual owner source and real marker files; helper, launcher and win32 are
// explicit test doubles. This is not native job/ACL/credential verification.
const source = join(dirname(fileURLToPath(import.meta.url)), 'windows-job-owner.ts')
const fixed = Buffer.from('synthetic pinned source')
const sha = crypto.createHash('sha256').update(fixed).digest('hex')
const compiledSource = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: source,
}).outputText
const core = { 'node:fs': fs, 'node:crypto': crypto, 'node:path': paths }
const noop = () => {}
function peer(pid) {
  const child = new EventEmitter()
  Object.assign(child, { pid, stdout: new PassThrough(), stderr: new PassThrough(),
    kills: [], closed: false, unref: noop, exitCode: null, signalCode: null })
  child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback() } })
  child.reply = reply => child.stdout.write(`${JSON.stringify(reply)}\n`)
  child.exit = (code = 0) => { child.exitCode = code; child.emit('exit', code, null) }
  child.close = (code = 0) => {
    if (child.closed) return
    child.closed = true
    child.exit(code)
    child.stdout.end(); child.stderr.end()
    child.emit('close', code, null)
  }
  child.kill = signal => { child.kills.push(signal); return true }
  return child
}
async function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(join(tmpdir(), 'dsh861-gate-owner-test-'))
  const helper = peer(43001)
  const launcher = peer(43002)
  const operations = []
  let launches = 0
  let assignReply
  helper.stdin = new Writable({ write(chunk, _encoding, callback) {
    const request = JSON.parse(chunk.toString())
    operations.push(request)
    if (request.op === 'status') helper.reply({ ok: true, created: false, active: 0 })
    if (request.op === 'assign') {
      assignReply = () => helper.reply(options.assignFalse
        ? { ok: false, code: 'OWNER_ASSIGN_FAILED' } : { ok: true, assigned: true })
      if (!options.delayAssign) assignReply()
    }
    if (request.op === 'terminate') helper.reply({ ok: true, terminated: true })
    if (request.op === 'dispose') {
      helper.reply({ ok: true, disposed: true })
      queueMicrotask(() => helper.close())
    }
    callback()
  } })
  const context = vm.createContext({ Buffer, setTimeout, clearTimeout, process: { platform: 'win32', execPath: '/fake/node' } })
  const mocks = {
    'node:child_process': { spawn(executable) {
      if (executable === '/fake/powershell') return helper
      launches++
      if (options.spawnThrows) throw new Error('synthetic spawn failure')
      return launcher
    } },
    'node:fs/promises': { ...fsp, readFile: async () => fixed, realpath: async path => path },
  }
  const main = new vm.SourceTextModule(compiledSource, { context, identifier: source })
  await main.link(async id => {
    const exports = mocks[id] ?? core[id]
    if (!exports) throw new Error('Undeclared test module: ' + id)
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await main.evaluate()
  const owner = await main.namespace.createProcessJobOwner({ powershellExecutable: '/fake/powershell', directory,
    sha256: { executable: sha, helper: sha, launcher: sha },
    environment: { SystemRoot: directory, TEMP: directory, TMP: directory }, replyTimeoutMs: 150 })
  const request = { executable: '/fake/cli', args: ['exec'], workingDirectory: directory,
    environment: {}, maxWaitMs: 5000 }
  const gateDirectory = () => fs.readdirSync(directory).find(name => name.startsWith('dsh861-launch-gate-'))
  const marker = name => { const folder = gateDirectory(); return !!folder && fs.existsSync(join(directory, folder, name)) }
  t.after(async () => {
    launcher.close(); helper.close()
    await owner.dispose().catch(noop)
    helper.stdin.destroy(); launcher.stdin.destroy()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return { owner, helper, launcher, request, marker, operations, gateDirectory,
    launches: () => launches, resolveAssignment: () => assignReply?.() }
}

test('release without launcher assignment cannot write go', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
  assert.equal(f.marker('go'), false)
})
test('assignment of another PID cannot authorize the launcher', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  assert.equal(await f.owner.assign(f.launcher.pid + 1), false)
  assert.equal(f.operations.filter(op => op.op === 'assign').length, 0)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
test('successful assignment permits exactly one release', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  assert.equal(await f.owner.assign(f.launcher.pid), true)
  f.owner.releaseGated()
  assert.equal(f.marker('go'), true)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
test('negative assignment aborts the gate and cannot release', async t => {
  const f = await fixture(t, { assignFalse: true }); f.owner.launchGated(f.request)
  assert.equal(await f.owner.assign(f.launcher.pid), false)
  assert.equal(f.marker('abort'), true)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
for (const event of ['error', 'exit', 'close']) {
  test(`helper ${event} before assignment aborts and directly terminates the gate`, async t => {
    const f = await fixture(t); f.owner.launchGated(f.request)
    if (event === 'error') f.helper.emit('error', new Error('synthetic failure'))
    else if (event === 'exit') f.helper.exit(9)
    else f.helper.close(9)
    assert.equal(f.marker('abort'), true)
    assert.ok(f.launcher.kills.length > 0, 'unassigned launcher was left running')
    assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
    assert.equal(f.marker('go'), false)
  })
}
test('late successful assignment after helper failure is not authorization', async t => {
  const f = await fixture(t, { delayAssign: true }); f.owner.launchGated(f.request)
  const assigned = f.owner.assign(f.launcher.pid)
  f.helper.reply({ ok: true, assigned: true })
  f.helper.exit(9)
  assert.equal(await assigned, false)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
test('abort is latched even when an assignment response arrives later', async t => {
  const f = await fixture(t, { delayAssign: true }); f.owner.launchGated(f.request)
  const assigned = f.owner.assign(f.launcher.pid)
  f.owner.abortGated(); f.resolveAssignment()
  assert.equal(await assigned, false)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
  assert.equal(f.marker('go'), false)
})
test('termination before release prevents every later release', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  assert.equal(await f.owner.assign(f.launcher.pid), true)
  await f.owner.terminateOwned()
  assert.equal(f.marker('abort'), true)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
test('dispose aborts an unassigned gate and waits for its close', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  let resolved = false
  const disposal = f.owner.dispose().then(() => { resolved = true })
  await tick()
  assert.equal(f.marker('abort'), true)
  assert.equal(resolved, false)
  f.launcher.close()
  await disposal
  assert.equal(f.gateDirectory(), undefined)
})
test('dispose refuses success if the unassigned launcher never closes', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  await assert.rejects(f.owner.dispose(), /OWNER_REPLY_TIMEOUT/)
  assert.notEqual(f.gateDirectory(), undefined, 'unknown-live gate markers were erased')
})
test('launch after disposal is refused before allocating a directory', async t => {
  const f = await fixture(t); await f.owner.dispose()
  assert.throws(() => f.owner.launchGated(f.request), /OWNER_PROTOCOL_INVALID/)
  assert.equal(f.gateDirectory(), undefined)
  assert.equal(f.launches(), 0)
})
test('launch after helper failure is refused before allocating a directory', async t => {
  const f = await fixture(t); f.helper.close(1)
  assert.throws(() => f.owner.launchGated(f.request), /OWNER_PROTOCOL_INVALID/)
  assert.equal(f.gateDirectory(), undefined)
})
test('launcher close before assignment cannot be used as a stale PID', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request); f.launcher.close(2)
  assert.equal(await f.owner.assign(f.launcher.pid), false)
  assert.equal(f.operations.filter(op => op.op === 'assign').length, 0)
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
test('launcher errors have an owner listener even before caller attachment', async t => {
  const f = await fixture(t); f.owner.launchGated(f.request)
  assert.doesNotThrow(() => f.launcher.emit('error', new Error('synthetic launch error')))
  assert.throws(() => f.owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
})
test('synchronous launcher failure removes only its newly created directory', async t => {
  const f = await fixture(t, { spawnThrows: true })
  assert.throws(() => f.owner.launchGated(f.request), /OWNER_HELPER_START_FAILED/)
  assert.equal(f.gateDirectory(), undefined)
})
for (const value of [0, 1.5, Infinity]) {
  test(`invalid gate wait ${value} is rejected before launch`, async t => {
    const f = await fixture(t)
    assert.throws(() => f.owner.launchGated({ ...f.request, maxWaitMs: value }), /OWNER_HELPER_INVALID/)
    assert.equal(f.launches(), 0)
    assert.equal(f.gateDirectory(), undefined)
  })
}
