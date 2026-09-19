// Negative-control C probe: measures how much synchronous work the close
// notification performs after the enumeration already settled (cancel).
// Run against the fixed wiring (guard present -> ~0 ms) and against the
// eager-evaluation mutant (guard removed -> a full parse + walk of a large
// table inside the close handler). Not part of the repository.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = 'C:/Albert/project/dsh861'
const runGatesUrl = pathToFileURL(join(repoRoot, 'scripts', 'run-gates.ts')).href
const childScript = `
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { performance } from 'node:perf_hooks'
import { wireDescendantEnumeration } from ${JSON.stringify(runGatesUrl)}
class FakeEnumerationChild extends EventEmitter {
  constructor() { super(); this.stdout = new PassThrough(); this.kills = [] }
  kill(signal) { this.kills.push(signal ?? 'SIGTERM'); return true }
}
const payload = JSON.parse(readFileSync(0, 'utf8'))
const child = new FakeEnumerationChild()
const enumeration = wireDescendantEnumeration(payload.root, child)
child.stdout.write(payload.stdoutText)
enumeration.cancel()
const started = performance.now()
child.emit('close', 0, null)
const closeHandlerMs = performance.now() - started
const result = await enumeration.promise
process.stdout.write(JSON.stringify({ closeHandlerMs: Math.round(closeHandlerMs), resultLength: result.length, kills: child.kills.length }))
`

const chainLength = 2_000_000
let stdoutText = '2 1\n'
for (let pid = 3; pid <= chainLength + 1; pid += 1) stdoutText += `${pid} ${pid - 1}\n`

const directory = mkdtempSync(join(tmpdir(), 'dsh-r37-probe-c-'))
const script = join(directory, 'probe-child.mjs')
writeFileSync(script, childScript, 'utf8')
try {
  const run = spawnSync(process.execPath, ['--import', 'tsx/esm', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: JSON.stringify({ root: 1, stdoutText }),
    timeout: 120000,
  })
  process.stdout.write(`status=${run.status} signal=${run.signal} out=${run.stdout.trim()}\n`)
} finally {
  rmSync(directory, { recursive: true, force: true })
}
