import assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as paths from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// Real Windows helper and launcher; a spawn observer retains only this test's
// child handles. No process enumeration, production credentials, model or network.
const directory = fileURLToPath(new URL('.', import.meta.url))
const compiled = ts.transpileModule(fs.readFileSync(paths.join(directory, 'windows-job-owner.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const core = { 'node:fs': fs, 'node:fs/promises': fsp, 'node:crypto': crypto, 'node:path': paths }
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
async function bounded(promise, timeoutMs) {
  let timer
  try {
    return await Promise.race([promise, new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('owned test child did not close in time')), timeoutMs)
    })])
  } finally { clearTimeout(timer) }
}
for (const assignedFirst of [false, true]) {
  test(`native helper death ${assignedFirst ? 'after' : 'before'} assignment prevents target launch`, {
    skip: process.platform !== 'win32', timeout: 60000,
  }, async t => {
    const root = fs.mkdtempSync(paths.join(tmpdir(), 'dsh861-native-gate-failure-'))
    const powershell = paths.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const children = []
    let owner
    t.after(async () => {
      for (const item of children) if (!item.closed) item.child.kill('SIGKILL')
      for (const item of children) await bounded(item.close, 10000)
      await owner?.dispose().catch(() => {}) // An intentionally killed helper must not certify disposal.
      fs.rmSync(root, { recursive: true, force: true })
    })
    const context = vm.createContext({ Buffer, setTimeout, clearTimeout, process })
    const main = new vm.SourceTextModule(compiled, { context })
    const observedSpawn = (executable, args, options) => {
      const child = childProcess.spawn(executable, args, options)
      const item = { child, executable, closed: false, close: undefined }
      item.close = new Promise(resolve => child.once('close', (code, signal) => {
        item.closed = true; resolve({ code, signal })
      }))
      children.push(item)
      return child
    }
    await main.link(async id => {
      const exports = id === 'node:child_process' ? { ...childProcess, spawn: observedSpawn } : core[id]
      if (!exports) throw new Error('undeclared module in native fixture')
      return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
      }, { context })
    })
    await main.evaluate()
    owner = await main.namespace.createProcessJobOwner({ powershellExecutable: powershell, directory,
      sha256: { executable: digest(powershell), helper: digest(paths.join(directory, 'job-owner.ps1')),
        launcher: digest(paths.join(directory, 'launch-gate.mjs')) },
      environment: { SystemRoot: process.env.SystemRoot, TEMP: root, TMP: root }, replyTimeoutMs: 10000 })
    const target = paths.join(root, 'target.mjs'), marker = paths.join(root, 'target-started')
    fs.writeFileSync(target, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'started')\n`)
    const launcher = owner.launchGated({ executable: process.execPath, args: [target],
      workingDirectory: root, environment: { SystemRoot: process.env.SystemRoot }, maxWaitMs: 30000 })
    launcher.stdout.resume(); launcher.stderr.resume()
    assert.equal(children.length, 2)
    const helper = children[0], gate = children[1]
    assert.equal(helper.executable, powershell)
    assert.equal(gate.child, launcher)
    if (assignedFirst) assert.equal(await owner.assign(launcher.pid), true)
    assert.equal(helper.child.kill('SIGKILL'), true)
    await bounded(helper.close, 10000)
    assert.throws(() => owner.releaseGated(), /OWNER_PROTOCOL_INVALID/)
    // Below the 30-second launcher self-timeout: the owner must terminate it.
    await bounded(gate.close, 10000)
    assert.equal(fs.existsSync(marker), false)
    await assert.rejects(owner.dispose(), /OWNER_/)
    assert.deepEqual(fs.readdirSync(root).filter(name => name.startsWith('dsh861-launch-gate-')), [])
  })
}
