import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

// Real Node helper/target execution, no Windows job, credentials or network.
const root = dirname(fileURLToPath(import.meta.url))
const launcher = join(root, 'launch-gate.mjs')
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh861-launch-protocol-'))
  const target = join(directory, 'target.mjs')
  const started = join(directory, 'target.started')
  writeFileSync(target, "import { writeFileSync } from 'node:fs'; writeFileSync('target.started', 'started'); process.stdin.pipe(process.stdout)\n")
  const specFile = join(directory, 'launch.json'), go = join(directory, 'go'), abort = join(directory, 'abort')
  const spec = { executable: process.execPath, args: [target], cwd: directory }
  writeFileSync(specFile, JSON.stringify(spec))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return { directory, target, started, specFile, go, abort, spec,
    run: (wait = '200', extra = []) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [launcher, specFile, go, abort, wait, ...extra], {
        cwd: directory, stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true,
      })
      const stdout = [], stderr = []
      const timer = setTimeout(() => { child.kill(); reject(new Error('Synthetic launcher timed out')) }, 5000)
      child.on('error', error => { clearTimeout(timer); reject(error) })
      child.stdout.on('data', bytes => stdout.push(bytes))
      child.stderr.on('data', bytes => stderr.push(bytes))
      child.stdin.on('error', () => {}) // Refusal closes stdin without accepting input.
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        resolve({ code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) })
      })
      child.stdin.end(Buffer.from([0, 65, 255, 10]))
    }) }
}
async function refuses(f, wait, expected = 2, extra = []) {
  const result = await f.run(wait, extra)
  assert.equal(result.code, expected)
  assert.equal(result.signal, null)
  assert.equal(result.stderr.length, 0)
  assert.equal(existsSync(f.started), false)
}
test('release preserves target stdin bytes and ordinary exit', async t => {
  const f = fixture(t); writeFileSync(f.go, '')
  const result = await f.run()
  assert.equal(result.code, 0)
  assert.equal(existsSync(f.started), true)
  assert.deepEqual(result.stdout, Buffer.from([0, 65, 255, 10]))
  assert.equal(result.stderr.length, 0)
})
test('missing release times out without creating the target', async t => {
  await refuses(fixture(t), '40', 5)
})
test('abort wins when both marker files exist', async t => {
  const f = fixture(t); writeFileSync(f.go, ''); writeFileSync(f.abort, '')
  await refuses(f, '100', 4)
})
for (const value of ['0', 'Infinity', '2147483648']) {
  test(`invalid wait ${value} cannot create the target even with go present`, async t => {
    const f = fixture(t); writeFileSync(f.go, '')
    await refuses(f, value)
  })
}
for (const [name, value] of [['null', null], ['unexpected field', { auth: 'synthetic-only' }], ['NUL path', { executable: 'bad\0path' }]]) {
  test(`invalid launch file ${name} fails without echoing parse data`, async t => {
    const f = fixture(t); writeFileSync(f.go, '')
    writeFileSync(f.specFile, JSON.stringify(value === null ? null : { ...f.spec, ...value }))
    await refuses(f, '100')
  })
}
test('extra launcher arguments are refused', async t => {
  const f = fixture(t); writeFileSync(f.go, '')
  await refuses(f, '100', 2, ['unexpected'])
})
test('target nonzero exit is preserved', async t => {
  const f = fixture(t); writeFileSync(f.go, '')
  writeFileSync(f.target, 'process.exitCode = 7\n')
  assert.equal((await f.run()).code, 7)
})
test('failed target spawn returns a fixed code without raw diagnostics', async t => {
  const f = fixture(t); writeFileSync(f.go, '')
  writeFileSync(f.specFile, JSON.stringify({ ...f.spec, executable: join(f.directory, 'does-not-exist') }))
  await refuses(f, '100', 3)
})

// Deterministic clock/file observations prove deadline and abort ordering.
// No timing-sensitive late filesystem writes and no actual target process.
for (const mode of ['late release after expiry', 'abort at final release check']) {
  test(`${mode} cannot pass the final launch decision`, async () => {
    let nowCalls = 0, goReads = 0, abortReads = 0, spawns = 0
    const clock = () => mode === 'late release after expiry' ? (++nowCalls < 3 ? 0 : 100) : 0
    const output = []
    class Exit extends Error { constructor(code) { super('synthetic exit'); this.code = code } }
    const context = vm.createContext({ process: { argv: ['node', 'gate', '/spec', '/go', '/abort', '20'],
      exit: code => { throw new Exit(code) } }, Date: { now: clock }, setTimeout: fn => { fn(); return 1 } })
    const exports = {
      'node:fs': { statSync: () => ({ size: 100 }),
        readFileSync: () => JSON.stringify({ executable: '/target', args: [], cwd: '/cwd' }),
        existsSync: file => {
          if (file === '/abort') return mode !== 'late release after expiry' && ++abortReads >= 2
          return mode === 'late release after expiry' ? ++goReads >= 2 : true
        } },
      'node:child_process': { spawn: () => { spawns++; return { on: () => {} } } },
      'node:path': { isAbsolute: value => value.startsWith('/') },
      'node:perf_hooks': { performance: { now: clock } },
    }
    const module = new vm.SourceTextModule(readFileSync(launcher, 'utf8'), { context })
    await module.link(async id => new vm.SyntheticModule(Object.keys(exports[id]), function () {
      for (const [name, value] of Object.entries(exports[id])) this.setExport(name, value)
    }, { context }))
    try { await module.evaluate() } catch (error) { if (error instanceof Exit) output.push(error.code); else throw error }
    assert.equal(spawns, 0)
    assert.deepEqual(output, [mode === 'late release after expiry' ? 5 : 4])
  })
}
