/** Synthetic file-access probe; never accepts model output or production file paths. */
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const attempt = action => {
  try { return { outcome: 'allowed', sha256: hash(action()) } }
  catch (error) { return { outcome: 'error', code: typeof error.code === 'string' ? error.code : 'UNKNOWN' } }
}
const [, , mode, ...args] = process.argv
if (mode === 'child-read' && args.length === 2) {
  const [nonce, file] = args
  process.stdout.write(JSON.stringify({ version: 1, nonce, pid: process.pid, result: attempt(() => readFileSync(file)) }) + '\n')
} else if (mode === 'probe' && args.length === 5) {
  const [nonce, allowed, outside, insideWrite, outsideWrite] = args
  const write = file => attempt(() => { writeFileSync(file, 'SYNTHETIC-WRITE\n', { flag: 'wx' }); return Buffer.from('created') })
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'child-read', nonce, outside],
    { encoding: 'utf8', timeout: 5000, maxBuffer: 8192, windowsHide: true, shell: false })
  let childReceipt
  try { childReceipt = JSON.parse(child.stdout) } catch { /* absent or invalid child data cannot prove denial */ }
  process.stdout.write(JSON.stringify({ version: 1, nonce, pid: process.pid, cwd: realpathSync(process.cwd()),
    allowedRead: attempt(() => readFileSync(allowed)), outsideRead: attempt(() => readFileSync(outside)),
    insideWrite: write(insideWrite), outsideWrite: write(outsideWrite),
    child: { exitCode: child.status, signal: child.signal, started: !child.error && childReceipt !== undefined,
      ...(childReceipt ? { receipt: childReceipt } : {}) } }) + '\n')
} else {
  process.stderr.write('SANDBOX_PROBE_ARGUMENTS_INVALID\n')
  process.exitCode = 2
}
