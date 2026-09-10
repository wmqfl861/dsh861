// Private, integrity-pinned launch helper. The owner supplies non-secret files
// in its protected directory and releases this process only after assigning it
// to the invocation's job. Abort takes precedence over release. Waiting uses
// monotonic time; an expired wait never accepts a newly discovered go marker.
// stdin/stdout/stderr belong to the target and are not used for control messages.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { performance } from 'node:perf_hooks'

const input = process.argv.slice(2)
if (input.length !== 4) process.exit(2)
const [specFile, goFile, abortFile, waitMsText] = input
const waitMs = Number(waitMsText)
if (![specFile, goFile, abortFile].every(isAbsolute)
  || !Number.isSafeInteger(waitMs) || waitMs < 1 || waitMs > 2147483647) process.exit(2)
let spec
try {
  if (statSync(specFile).size > 1024 * 1024) process.exit(2)
  spec = JSON.parse(readFileSync(specFile, 'utf8'))
} catch { process.exit(2) }
if (spec === null || typeof spec !== 'object' || Array.isArray(spec)
  || Object.keys(spec).sort().join(',') !== 'args,cwd,executable'
  || typeof spec.executable !== 'string' || !isAbsolute(spec.executable) || spec.executable.includes('\0')
  || !Array.isArray(spec.args) || spec.args.some(argument => typeof argument !== 'string' || argument.includes('\0'))
  || typeof spec.cwd !== 'string' || !isAbsolute(spec.cwd) || spec.cwd.includes('\0')) process.exit(2)

const start = performance.now()
let released = false
while (performance.now() - start < waitMs) {
  if (existsSync(abortFile)) process.exit(4)
  if (existsSync(goFile)) { released = true; break }
  await new Promise(resolve => setTimeout(resolve, Math.min(15, waitMs)))
}
if (existsSync(abortFile)) process.exit(4)
if (!released) process.exit(5)
try {
  const cli = spawn(spec.executable, spec.args, { cwd: spec.cwd, stdio: 'inherit', shell: false, windowsHide: true })
  cli.on('error', () => process.exit(3))
  cli.on('exit', (code, signal) => process.exit(signal === null ? (code ?? 3) : 1))
} catch { process.exit(3) }
