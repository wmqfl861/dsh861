// Gated CLI launcher for one planner invocation under a caller-owned Windows
// job. The wrapper spawns this launcher with the CLI's stdio pipes attached;
// the launcher reads its launch spec, then holds the CLI start until the go
// marker appears. The wrapper writes that marker only after the launcher PID
// joined the owned job, so the CLI is created by a confirmed job member and
// joins the job before its first code runs. The launcher never reads stdin
// (the CLI owns that pipe), passes its own inherited handles to the CLI, and
// exits with the CLI's exit code. An abort marker, or the bounded wait ending
// without a go marker, ends the launcher without ever creating the CLI.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const [specFile, goFile, abortFile, waitMsText] = process.argv.slice(2)
if (specFile === undefined || goFile === undefined || abortFile === undefined || waitMsText === undefined) process.exit(2)
const waitMs = Number(waitMsText)
if (!Number.isInteger(waitMs) || waitMs < 1) process.exit(2)
let spec
try {
  spec = JSON.parse(readFileSync(specFile, 'utf8'))
} catch { process.exit(2) }
if (typeof spec.executable !== 'string' || spec.executable.length === 0 || !Array.isArray(spec.args)
  || spec.args.some(argument => typeof argument !== 'string') || typeof spec.cwd !== 'string') process.exit(2)
const waitUntil = Date.now() + waitMs
while (Date.now() < waitUntil) {
  if (existsSync(abortFile)) process.exit(4)
  if (existsSync(goFile)) break
  await new Promise(resolve => setTimeout(resolve, 15))
}
if (!existsSync(goFile)) process.exit(5)
const cli = spawn(spec.executable, spec.args, { cwd: spec.cwd, stdio: 'inherit', shell: false, windowsHide: true })
cli.on('error', () => process.exit(3))
cli.on('exit', (code, signal) => process.exit(signal === null ? (code ?? 3) : 1))
