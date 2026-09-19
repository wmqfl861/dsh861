// r38 mutation negative control, attempt 3: identical to v2 but (a) runs
// against the final candidate spec (post-typecheck-fix bytes), and (b) strips
// ANSI escapes before parsing the vitest summary, so the verdict and exit code
// reflect the run instead of a parsing artifact. v1 (logs 03/04) lost the -t
// quoting through cmd /s /c and matched zero tests; v2 (logs 05/06) produced
// the real 5-failure rejection on the pre-typecheck-fix candidate but exited
// 98 because its verdict regex did not account for ANSI escapes.
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const runner = 'C:/Albert/project/dsh861/scripts/run-gates.ts'
const repoRoot = 'C:/Albert/project/dsh861'
const pnpm = 'C:/dsh-r24-upgrade-20260912-01/pnpm-12.4.1/pnpm.exe'
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
if (original.includes('\r\n')) throw new Error('runner unexpectedly contains CRLF; needle is LF-only')
if (count(originalText, guardNeedle) !== 1) {
  throw new Error(`close-guard needle matched ${count(originalText, guardNeedle)} times; refusing to mutate`)
}

let vitestStatus = -1
let verdict = 'inconclusive'
try {
  const mutatedText = originalText.replace(guardNeedle, mutatedNeedle)
  if (mutatedText === originalText) throw new Error('mutation did not change the file')
  const remaining = count(mutatedText, 'if (settled) return')
  if (remaining !== 1) throw new Error(`expected exactly 1 remaining settled guard (finish), got ${remaining}`)
  writeFileSync(runner, mutatedText, 'utf8')
  const mutated = readFileSync(runner)
  console.log(`mutated: ${mutated.length} bytes, sha256=${sha256(mutated)}, git-blob=${gitBlobHash(mutated)}`)

  const run = spawnSync(pnpm, [
    'exec', 'vitest', 'run', '--project', 'thread-safe', 'scripts/run-gates.spec.ts',
    '-t', 'asynchronous enumeration',
  ], {
    cwd: repoRoot,
    env: { ...process.env, PATH: `C:\\dsh-r24-upgrade-20260912-01\\node-v26.8.2-win-x64;C:\\dsh-r24-upgrade-20260912-01\\pnpm-12.4.1;${process.env.PATH ?? ''}` },
    encoding: 'buffer',
    timeout: 240000,
    maxBuffer: 64 * 1024 * 1024,
  })
  vitestStatus = run.status
  const text = Buffer.concat([run.stdout ?? Buffer.alloc(0), run.stderr ?? Buffer.alloc(0)]).toString('utf8')
  writeFileSync('C:/Albert/r38-scratch/raw/12-mutation-focused-v3.txt', text)
  const plain = text.replace(/\x1b\[[0-9;]*[mK]/g, '')
  const summary = plain.split('\n').filter(line => line.includes('Tests') && /passed|failed/.test(line)).pop() ?? 'no summary line'
  console.log(`focused run under mutation: status=${String(vitestStatus)} error=${run.error?.message ?? 'none'}`)
  console.log(`vitest summary: ${summary.trim()}`)
  const failed = Number(/(\d+) failed/.exec(summary)?.[1] ?? '0')
  const passed = Number(/(\d+) passed/.exec(summary)?.[1] ?? '0')
  if (passed + failed <= 0) {
    verdict = `invalid: zero executed tests (${summary.trim()})`
  } else if (vitestStatus !== 0 && failed > 0) {
    verdict = `rejected-mutation: ${failed} failed assertion(s), ${passed} passed, nonzero exit ${vitestStatus}`
  } else {
    verdict = `FAILED-CONTROL: mutation survived (${summary.trim()}, status=${String(vitestStatus)})`
  }
  for (const line of plain.split('\n').filter(line => line.includes('FAIL') || line.includes('AssertionError')).slice(0, 12)) {
    console.log(line.trim())
  }
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
console.log(`driver verdict: ${verdict}`)
if (!verdict.startsWith('rejected-mutation') && process.exitCode !== 99) process.exitCode = 98
