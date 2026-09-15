// r36 negative controls: real mutations, real vitest runs, byte-for-byte restore in finally.
// Lives outside the repository (C:\dsh-r36-20260915-01); touches only worktree bytes,
// restores every file it mutates, and verifies the restored git blob after each case.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const REPO = 'C:/Albert/project/dsh861'
const VITEST_CONFIG = `${REPO}/vitest.config.ts`
const E2B_SPEC = `${REPO}/packages/e2b/subprocess-e2b/tests/subprocess.spec.ts`
const PROXY_SPEC = 'scripts/test-proxy-environment.spec.ts'
const RESULTS = []

function gitBlob(path) {
  return execFileSync('git', ['hash-object', path], { cwd: REPO, encoding: 'utf8' }).trim()
}

function vitest(args) {
  try {
    const stdout = execFileSync('pnpm', ['exec', 'vitest', 'run', ...args], {
      cwd: REPO, encoding: 'utf8', timeout: 240_000, stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { exit: 0, stdout }
  } catch (error) {
    return { exit: error.status ?? 'NO_STATUS', stdout: (error.stdout ?? '') + (error.stderr ?? '') }
  }
}

/** Replace exactly the nth occurrence of needle in text. */
function replaceNth(text, needle, replacement, n) {
  let index = -1
  for (let i = 0; i < n; i += 1) {
    index = text.indexOf(needle, index + 1)
    if (index === -1) throw new Error(`occurrence ${i + 1} of needle not found`)
  }
  return text.slice(0, index) + replacement + text.slice(index + needle.length)
}

function control({ name, file, mutate, args, expectFailWith }) {
  const original = readFileSync(file, 'utf8')
  const before = gitBlob(file)
  let mutatedRun
  try {
    const mutated = mutate(original)
    if (mutated === original) throw new Error(`${name}: mutation did not apply`)
    writeFileSync(file, mutated)
    mutatedRun = vitest(args)
    const matched = expectFailWith(mutatedRun.stdout) || expectFailWith(mutatedRun.stderr ?? '')
    RESULTS.push({
      name, exit: mutatedRun.exit, expectedFailureSeen: matched === true,
      applied: true,
    })
  } finally {
    writeFileSync(file, original)
  }
  const afterRestore = gitBlob(file)
  const restoreRun = vitest(args)
  RESULTS.push({ name: `${name} [restore]`, blobRestored: afterRestore === before, greenAfterRestore: restoreRun.exit === 0 })
}

control({
  name: 'NC1-missing-proxy-init (shared constant loses the proxy setup entry)',
  file: VITEST_CONFIG,
  mutate: text => text.replace(
    "const testSetupFiles = ['./scripts/test-proxy-environment.ts', './scripts/test-invariants.ts']",
    "const testSetupFiles = ['./scripts/test-invariants.ts']",
  ),
  args: [PROXY_SPEC],
  expectFailWith: out => out.includes('setup in every setupFiles it declares') && /\d+ failed/.test(out),
})

control({
  name: 'NC2-unknown-reference (slot names a constant with no array-literal declaration)',
  file: VITEST_CONFIG,
  mutate: text => replaceNth(text, 'setupFiles: testSetupFiles,', 'setupFiles: missingSetupFiles,', 1),
  args: [PROXY_SPEC],
  expectFailWith: out => out.includes('missingSetupFiles') || out.includes('no array-literal const declaration'),
})

control({
  name: 'NC3-single-project-disconnect (process-bound project lists its own setup without the proxy entry)',
  file: VITEST_CONFIG,
  mutate: text => replaceNth(text, 'setupFiles: testSetupFiles,', "setupFiles: ['./scripts/test-invariants.ts'],", 3),
  args: [PROXY_SPEC],
  expectFailWith: out => out.includes('setup in every setupFiles it declares') && /\d+ failed/.test(out),
})

control({
  name: 'NC5-void-restore (rejects assertion discarded with void again)',
  file: E2B_SPEC,
  mutate: text => text.replace(
    'await expect(service.spawnTerminal({',
    'void expect(service.spawnTerminal({',
  ),
  args: ['packages/e2b/subprocess-e2b/tests/subprocess.spec.ts', '-t', 'unrepresentable graceMs'],
  expectFailWith: out => out.includes('was not awaited'),
})

console.log(JSON.stringify(RESULTS, null, 2))
const failed = RESULTS.filter(r => (r.expectedFailureSeen === false) || (r.blobRestored === false) || (r.greenAfterRestore === false))
if (failed.length > 0) {
  console.error(`NEGATIVE CONTROL VERDICT: FAIL (${failed.length} unsatisfied case arms)`)
  process.exit(1)
}
console.error('NEGATIVE CONTROL VERDICT: PASS (every mutation failed its spec, every restore byte-identical, every post-restore run green)')
