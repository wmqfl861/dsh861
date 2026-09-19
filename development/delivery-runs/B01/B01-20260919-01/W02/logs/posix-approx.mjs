/**
 * W02 Linux-rework POSIX approximation harness (B01-20260919-01 rework,
 * CI run 35447649954). This Windows host cannot flip process.platform, so
 * this harness validates the four reworked mechanics against the REAL
 * production-of-truth module (`prepare-ci-bubblewrap-test-support.ts`)
 * under Git Bash, which shares the POSIX PATH/abs-bash semantics. Run from
 * the repo root with the repo's tsx hook:
 *   node --import tsx/esm C:/dsh-b01-w02/raw/posix-approx.mjs
 *
 *  A1  buildScenarioChildEnv(platform:'linux') dual-key merge produces a
 *      stub-first PATH with the functional tail appended (fix 2-3 env shape).
 *  A2  spawning the ABSOLUTE bash with a dual-key-poisoned env resolves the
 *      stub through `command -v uname`; a bare-name spawn dies ENOENT under
 *      the same env — the exact CI failure shape (fix 2-3).
 *  A3  posixParentPath:'omit' yields a stub-only PATH in which a decoy real
 *      tool on the withheld tail is unreachable; 'append' reaches it (fix 1).
 *  A4  the reworked stdin-mode tar stub logs after its stdin EOF, so a
 *      `dpkg-deb | tar -tf -` pipeline logs upstream-first on every
 *      iteration (fix 4 determinism argument, exercised locally).
 *
 * Runner differences are annotated in W02/rework-linux.md: msys /usr/bin
 * differs from Ubuntu's, and scheduling is not Linux's — the CI evidence
 * remains the authority for the pre-fix race.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { buildScenarioChildEnv, toMsysPosixPath } = await import(
  'file:///C:/Albert/project/dsh861/scripts/prepare-ci-bubblewrap-test-support.ts'
)

const BASH = 'C:\\Program Files\\Git\\usr\\bin\\bash.exe'
const tmp = mkdtempSync(join(tmpdir(), 'w02-rework-'))
const bin = join(tmp, 'bin')
mkdirSync(bin)
const stubBinMsys = toMsysPosixPath(bin)
writeFileSync(join(bin, 'uname'), '#!/bin/sh\nprintf \'%s\\n\' "stub-uname $*"\nexit 0\n')
chmodSync(join(bin, 'uname'), 0o755)

const run = (label, command, args, opts) => {
  const proc = spawnSync(command, args, { encoding: 'utf8', timeout: 15_000, ...opts })
  console.log(`\n### ${label}`)
  console.log(`status=${proc.status} error=${proc.error ? String(proc.error.code ?? proc.error) : 'null'}`)
  if (proc.stdout) console.log(`stdout: ${proc.stdout.trim()}`)
  if (proc.stderr) console.log(`stderr: ${proc.stderr.trim()}`)
  return proc
}

// A1: dual-key parent -> single stub-first PATH with functional tail.
const dualKey = [
  { name: 'Path', value: 'C:\\Windows\\System32;C:\\Program Files\\dotnet' },
  { name: 'PATH', value: '/usr/bin:/bin' },
]
const envDual = buildScenarioChildEnv({
  pathEntries: [stubBinMsys],
  parentPathEntries: dualKey,
  testVars: { STUB_SENTINEL: 'approx' },
  platform: 'linux',
})
console.log('### A1 linux dual-key env PATH =', envDual.PATH)
console.log('A1 path-named keys:', Object.keys(envDual).filter(k => k.toLowerCase() === 'path').join(','))

// A2: absolute bash + poisoned env resolves the stub; bare bash dies (CI shape).
run('A2 absolute bash, poisoned dual-key env, command -v uname', BASH, ['--noprofile', '--norc', '-c', 'command -v uname'], { env: envDual })
run('A2 control: BARE bash name, same env (the run-35447649954 failure shape)', 'bash', ['--noprofile', '--norc', '-c', 'command -v uname'], { env: envDual })

// A3: omit hides a decoy real tool; append reaches it.
const decoyDir = join(tmp, 'realtool')
mkdirSync(decoyDir)
writeFileSync(join(decoyDir, 'ninja'), '#!/bin/sh\nexit 0\n')
chmodSync(join(decoyDir, 'ninja'), 0o755)
const decoyMsys = toMsysPosixPath(decoyDir)
const decoyParent = [{ name: 'PATH', value: decoyMsys }]
const envAppend = buildScenarioChildEnv({ pathEntries: [stubBinMsys], parentPathEntries: decoyParent, testVars: {}, platform: 'linux' })
const envOmit = buildScenarioChildEnv({ pathEntries: [stubBinMsys], parentPathEntries: decoyParent, testVars: {}, platform: 'linux', posixParentPath: 'omit' })
run('A3 append: decoy ninja reachable through the tail', BASH, ['--noprofile', '--norc', '-c', 'command -v ninja'], { env: envAppend })
run('A3 omit: decoy ninja unreachable (stub-only PATH)', BASH, ['--noprofile', '--norc', '-c', 'command -v ninja; printf "exit=%s\\n" "$?"'], { env: envOmit })

// A4: pipeline log determinism with the reworked stdin-mode tar stub.
const pipeBin = join(tmp, 'pipebin')
mkdirSync(pipeBin)
const pipeLog = join(tmp, 'pipe.log')
writeFileSync(join(pipeBin, 'dpkg-deb'), [
  '#!/bin/sh',
  'printf \'%s\\n\' "dpkg-deb $*" >> "$STUB_LOG2"',
  'printf \'%s\\n\' "(stub tar stream)"',
  'exit 0',
].join('\n') + '\n')
writeFileSync(join(pipeBin, 'tar'), [
  '#!/bin/sh',
  'mode=$1 archive=$2',
  'if [ "$archive" = \'-\' ]; then',
  '    cat > /dev/null',
  '    printf \'%s\\n\' "tar $*" >> "$STUB_LOG2"',
  '    printf \'%s\\n\' \'./usr/lib/x/libcap.a\'',
  '    exit 0',
  'fi',
  'printf \'%s\\n\' "tar $*" >> "$STUB_LOG2"',
  'exit 0',
].join('\n') + '\n')
chmodSync(join(pipeBin, 'dpkg-deb'), 0o755)
chmodSync(join(pipeBin, 'tar'), 0o755)
const pipeEnv = { STUB_LOG2: toMsysPosixPath(pipeLog), PATH: `${toMsysPosixPath(pipeBin)}:/usr/bin` }
let allUpstreamFirst = true
for (let i = 0; i < 20; i += 1) {
  writeFileSync(pipeLog, '')
  const proc = spawnSync(BASH, ['--noprofile', '--norc', '-c', 'set -o pipefail; dpkg-deb --fsys-tarfile x | tar -tf - | while IFS= read -r n; do [ -n "$n" ] || exit 1; done'], { encoding: 'utf8', timeout: 15_000, env: pipeEnv })
  const lines = readFileSync(pipeLog, 'utf8').split('\n').filter(l => l !== '')
  if (proc.status !== 0 || lines[0] === undefined || !lines[0].startsWith('dpkg-deb') || !(lines[1] ?? '').startsWith('tar')) {
    allUpstreamFirst = false
    console.log(`A4 iteration ${i}: UNEXPECTED status=${proc.status} lines=${JSON.stringify(lines)}`)
  }
}
console.log(`\n### A4 pipeline log order (20 iterations): allUpstreamFirst=${allUpstreamFirst}`)

rmSync(tmp, { recursive: true, force: true })
console.log('cleanup: probe tree removed')
