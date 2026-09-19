// r38 mutation negative control, attempt 2: previous attempt invoked vitest
// through `cmd /s /c`, whose quote stripping made the -t filter match zero
// tests (all skipped, exit 0 — an invalid control; preserved as raw logs 03/04).
// This driver calls pnpm.exe directly with an argument array, so the filter
// argument reaches vitest verbatim, and it refuses to accept a run whose
// executed-test count is zero.
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
  writeFileSync('C:/Albert/r38-scratch/raw/05-mutation-focused-v2.txt', text)
  const summary = text.split('\n').filter(line => line.includes('Tests') && line.includes('passed')).pop() ?? 'no summary line'
  console.log(`focused run under mutation: status=${String(vitestStatus)} error=${run.error?.message ?? 'none'}`)
  console.log(`vitest summary: ${summary.trim()}`)
  const counts = /Tests\s+(\d+) passed\s*\|\s*(\d+) failed\s*\|\s*(\d+) skipped/.exec(text)
    ?? /Tests\s+(\d+) failed\s*\|\s*(\d+) passed\s*\|\s*(\d+) skipped/.exec(text)
  if (counts === null) {
    verdict = `invalid: no pass/fail/skip summary parsed (status=${String(vitestStatus)})`
  } else {
    const executed = counts.slice(1).map(Number).reduce((a, b) => a + b, 0) - Number(counts[3])
    // executed = passed + failed (skipped subtracted); require a real run.
    if (Number(counts[1]) + Number(counts[2]) <= 0) {
      verdict = `invalid: zero executed tests (${summary.trim()})`
    } else if (vitestStatus !== 0 && Number(counts[2]) > 0) {
      verdict = `rejected-mutation: ${counts[2]} failed assertion(s), nonzero exit ${vitestStatus}`
    } else {
      verdict = `FAILED-CONTROL: mutation survived (${summary.trim()}, status=${String(vitestStatus)})`
    }
  }
  const failing = text.split('\n').filter(line => /×|FAIL|✗/.test(line)).slice(0, 12)
  for (const line of failing) console.log(line.trim())
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
if (!verdict.startsWith('rejected-mutation')) process.exitCode = process.exitCode ?? 98
