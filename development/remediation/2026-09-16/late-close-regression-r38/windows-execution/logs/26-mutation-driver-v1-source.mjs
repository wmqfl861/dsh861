// r38 mutation negative control: remove ONLY the settled guard at the start of
// the close callback in scripts/run-gates.ts, run the focused regression, then
// restore the saved original bytes in a finally block and verify the restore.
// The driver runs outside the repository; it writes no repository files except
// the temporary mutation of the runner itself, restored byte-exact in finally.
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const runner = 'C:/Albert/project/dsh861/scripts/run-gates.ts'
const repoRoot = 'C:/Albert/project/dsh861'
const expectedBlob = '664e1a0ef88f86b524dee39f684cd34e3cbba4a6'
const guardNeedle = '    if (settled) return\n    finish(collectDescendants(root, parsePidPpidLines(stdout)))'
const mutatedNeedle = '    finish(collectDescendants(root, parsePidPpidLines(stdout)))'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const gitBlobHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const count = (text, needle) => text.split(needle).length - 1

const original = readFileSync(runner)
const originalText = original.toString('utf8')
console.log(`original: ${original.length} bytes, sha256=${sha256(original)}, git-blob=${gitBlobHash(original)}`)
if (gitBlobHash(original) !== expectedBlob) {
  throw new Error(`baseline runner blob ${gitBlobHash(original)} != expected ${expectedBlob}; refusing to mutate`)
}
if (original.includes('\r\n')) {
  throw new Error('runner unexpectedly contains CRLF; needle is LF-only')
}
if (count(originalText, guardNeedle) !== 1) {
  throw new Error(`close-guard needle matched ${count(originalText, guardNeedle)} times; refusing to mutate`)
}

let exitCode = -1
let runError = undefined
try {
  const mutatedText = originalText.replace(guardNeedle, mutatedNeedle)
  if (mutatedText === originalText) throw new Error('mutation did not change the file')
  // finish's own guard must survive; only the close-callback guard is gone.
  const remaining = count(mutatedText, 'if (settled) return')
  if (remaining !== 1) throw new Error(`expected exactly 1 remaining settled guard (finish), got ${remaining}`)
  writeFileSync(runner, mutatedText, 'utf8')
  const mutated = readFileSync(runner)
  console.log(`mutated: ${mutated.length} bytes, sha256=${sha256(mutated)}, git-blob=${gitBlobHash(mutated)}`)

  const command = 'pnpm exec vitest run --project thread-safe scripts/run-gates.spec.ts -t "asynchronous enumeration"'
  const env = {
    ...process.env,
    PATH: `C:\\dsh-r24-upgrade-20260912-01\\node-v26.8.2-win-x64;C:\\dsh-r24-upgrade-20260912-01\\pnpm-12.4.1;${process.env.PATH ?? ''}`,
  }
  const run = spawnSync('cmd.exe', ['/d', '/s', '/c', command], { cwd: repoRoot, env, encoding: 'buffer', timeout: 240000, maxBuffer: 64 * 1024 * 1024 })
  exitCode = run.status
  runError = run.error?.message
  const output = Buffer.concat([run.stdout ?? Buffer.alloc(0), run.stderr ?? Buffer.alloc(0)])
  writeFileSync('C:/Albert/r38-scratch/raw/03-mutation-focused.txt', output)
  console.log(`focused run under mutation: status=${String(exitCode)} error=${runError ?? 'none'}`)
} finally {
  writeFileSync(runner, original, 'binary')
  const restored = readFileSync(runner)
  const restoredEqual = restored.equals(original)
  console.log(`restored: ${restored.length} bytes, byte-equal=${restoredEqual}, sha256=${sha256(restored)}, git-blob=${gitBlobHash(restored)}`)
  if (!restoredEqual || gitBlobHash(restored) !== expectedBlob) {
    console.error('RESTORE VERIFICATION FAILED')
    process.exitCode = 99
  }
}
console.log(`driver summary: vitest-status=${String(exitCode)} (nonzero expected), restore verified against blob ${expectedBlob}`)
