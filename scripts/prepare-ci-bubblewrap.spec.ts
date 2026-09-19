/**
 * Direct regression for `scripts/prepare-ci-bubblewrap.sh`: the real repository
 * script executes under real Bash while every external effect — `uname`,
 * `curl`, `sha256sum`, `dpkg-deb`, `sudo`, and the extracted `bwrap` — is a
 * test-owned PATH stub that only records argv and returns scenario-controlled
 * exit codes. No network, privilege escalation, sysctl change, or real
 * extraction ever happens: every write lands inside a per-run random temporary
 * directory that `afterAll` removes. A stub "hash match" proves control flow
 * only; the real payload identity is the pinned SHA-256 verified against the
 * official Ubuntu snapshot in the r47 acquisition evidence
 * (`development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/`).
 */

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'prepare-ci-bubblewrap.sh')
const repoRoot = resolve(dirname(scriptPath), '..')

const PINNED_VERSION = '0.9.0-1ubuntu0.1'
const PINNED_SHA256 = '1b506492bd9c7fd0cdb4f02ac822f1d3e336b0aead5113c1239baf8db5db562a'
/**
 * The only acquisition source the controlled stub network serves: the official
 * Ubuntu snapshot at the pinned UTC timestamp whose real 200/byte/hash evidence
 * the r47 round recorded. The rolling `archive.ubuntu.com` pool URL is dead
 * there (CI run 35413575204: curl 404 x4, step exit 22), so the stub refuses it
 * like any other unverified source.
 */
const PINNED_SNAPSHOT_URL = `https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_${PINNED_VERSION}_amd64.deb`

/** POSIX hosts always have bash; Windows needs Git Bash (MSYSTEM marker), matching the repo's bash-requiring suite convention. */
const bashProbe = spawnSync('bash', ['-c', 'printf %s ok'], { encoding: 'utf8' })
const bashUsable = bashProbe.status === 0 && (process.platform !== 'win32' || (bashProbe.stdout ?? '').includes('ok'))

interface ScenarioOptions {
  readonly curl: 'ok' | 'http404' | 'connfail'
  readonly hashMatches?: boolean
  readonly extractSucceeds?: boolean
  readonly sudoSucceeds?: boolean
  readonly probeSucceeds?: boolean
  readonly unameSys?: string
  readonly unameMachine?: string
  readonly dropRunnerTemp?: boolean
  readonly dropGithubPath?: boolean
}

interface ScenarioResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly stubCalls: readonly string[]
  readonly runnerTempChildPath: string
  readonly githubPathContent: string
  readonly archiveExists: boolean
  readonly extractionRootExists: boolean
  readonly extractedBwrapExists: boolean
}

/** Bash-facing path form: MSYS accepts `C:/...`; POSIX hosts pass through unchanged. */
const toChildPath = (value: string): string => (process.platform === 'win32' ? value.replaceAll('\\', '/') : value)

let scratchBase: string | undefined
const runDirs: string[] = []

/**
 * Write the stub `bin` directory and run the real script once against it.
 * @param options Scenario knobs for the stub exit codes and the child environment.
 * @returns The captured process output plus the observable filesystem effects inside the run directory.
 */
const runScenario = (options: ScenarioOptions): ScenarioResult => {
  scratchBase ??= mkdtempSync(join(tmpdir(), 'dsh-prepare-ci-bubblewrap-'))
  const runDir = mkdtempSync(join(scratchBase, 'run-'))
  runDirs.push(runDir)
  const bin = join(runDir, 'bin')
  const runnerTemp = join(runDir, 'runner-temp')
  const githubPath = join(runDir, 'github-path')
  const stubLog = join(runDir, 'stub.log')
  mkdirSync(bin)
  mkdirSync(runnerTemp)

  const stubs: Readonly<Record<string, string>> = {
    uname: [
      '#!/bin/sh',
      'printf \'%s\\n\' "uname $*" >> "$STUB_LOG"',
      'if [ "$1" = \'-s\' ]; then printf \'%s\\n\' "$STUB_UNAME_S"; exit 0; fi',
      'if [ "$1" = \'-m\' ]; then printf \'%s\\n\' "$STUB_UNAME_M"; exit 0; fi',
      'printf \'%s\\n\' Linux',
      'exit 0',
    ].join('\n') + '\n',
    curl: [
      '#!/bin/sh',
      'printf \'%s\\n\' "curl $*" >> "$STUB_LOG"',
      'out=\'\'',
      'url=\'\'',
      'prev=\'\'',
      'for arg in "$@"; do',
      '  if [ "$prev" = \'--output\' ]; then out=$arg; fi',
      '  case $arg in',
      '    https://*) url=$arg ;;',
      '  esac',
      '  prev=$arg',
      'done',
      'case $STUB_CURL_MODE in',
      '  ok)',
      '    if [ "$url" = "$STUB_CURL_GOOD_URL" ]; then',
      "      printf 'controlled-flow stub payload; real payload identity is the pinned SHA-256 from the r47 acquisition evidence\\n' > \"$out\"",
      '      exit 0',
      '    fi',
      "    printf 'curl: (22) The requested URL returned error: 404 Not Found (controlled stub serves only the verified snapshot source): %s\\n' \"$url\" >&2",
      '    exit 22',
      '    ;;',
      '  http404)',
      "    printf 'curl: (22) The requested URL returned error: 404\\n' >&2",
      '    exit 22',
      '    ;;',
      '  connfail)',
      "    printf 'curl: (7) Failed to connect to host\\n' >&2",
      '    exit 7',
      '    ;;',
      'esac',
      'exit 99',
    ].join('\n') + '\n',
    sha256sum: [
      '#!/bin/sh',
      'input=$(cat)',
      'printf \'%s\\n\' "sha256sum $* <<< $input" >> "$STUB_LOG"',
      'if [ "$STUB_HASH_MATCH" = \'1\' ]; then exit 0; fi',
      'exit 1',
    ].join('\n') + '\n',
    'dpkg-deb': [
      '#!/bin/sh',
      'printf \'%s\\n\' "dpkg-deb $*" >> "$STUB_LOG"',
      'if [ "$1" != \'--extract\' ]; then printf \'%s\\n\' \'dpkg-deb: stub supports --extract only\' >&2; exit 2; fi',
      'if [ "$STUB_DPKG_OK" != \'1\' ]; then printf \'%s\\n\' \'dpkg-deb: error: controlled extraction failure\' >&2; exit 2; fi',
      'mkdir -p "$3/usr/bin"',
      'cp "$STUB_BWRAP_SRC" "$3/usr/bin/bwrap"',
      'exit 0',
    ].join('\n') + '\n',
    sudo: [
      '#!/bin/sh',
      'printf \'%s\\n\' "sudo $*" >> "$STUB_LOG"',
      'if [ "$STUB_SUDO_OK" = \'1\' ]; then exit 0; fi',
      'printf \'%s\\n\' \'sysctl: controlled stub failure - knob absent\' >&2',
      'exit 1',
    ].join('\n') + '\n',
    'bwrap-payload': [
      '#!/bin/sh',
      'printf \'%s\\n\' "bwrap $*" >> "$STUB_LOG"',
      'if [ "$1" = \'--version\' ]; then printf \'%s\\n\' \'0.9.0\'; exit 0; fi',
      'if [ "$STUB_PROBE_OK" = \'1\' ]; then exit 0; fi',
      'printf \'%s\\n\' \'bwrap: controlled functional-probe failure\' >&2',
      'exit 17',
    ].join('\n') + '\n',
  }
  for (const [name, content] of Object.entries(stubs)) {
    writeFileSync(join(bin, name), content)
    chmodSync(join(bin, name), 0o755)
  }

  const childPathSeparator = process.platform === 'win32' ? ';' : ':'
  const env: NodeJS.ProcessEnv = { ...process.env }
  env.PATH = `${toChildPath(bin)}${childPathSeparator}${process.env.PATH ?? ''}`
  env.STUB_LOG = toChildPath(stubLog)
  env.STUB_UNAME_S = options.unameSys ?? 'Linux'
  env.STUB_UNAME_M = options.unameMachine ?? 'x86_64'
  env.STUB_CURL_MODE = options.curl
  env.STUB_CURL_GOOD_URL = PINNED_SNAPSHOT_URL
  env.STUB_HASH_MATCH = options.hashMatches === false ? '0' : '1'
  env.STUB_DPKG_OK = options.extractSucceeds === false ? '0' : '1'
  env.STUB_SUDO_OK = options.sudoSucceeds === false ? '0' : '1'
  env.STUB_PROBE_OK = options.probeSucceeds === false ? '0' : '1'
  env.STUB_BWRAP_SRC = toChildPath(join(bin, 'bwrap-payload'))
  if (options.dropRunnerTemp === true) {
    delete env.RUNNER_TEMP
  } else {
    env.RUNNER_TEMP = toChildPath(runnerTemp)
  }
  if (options.dropGithubPath === true) {
    delete env.GITHUB_PATH
  } else {
    env.GITHUB_PATH = toChildPath(githubPath)
    writeFileSync(githubPath, '')
  }

  const proc = spawnSync('bash', [toChildPath(scriptPath)], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  })
  const extractionRoot = join(runnerTemp, 'dsh-bubblewrap')
  const stubCalls = existsSync(stubLog) ? readFileSync(stubLog, 'utf8').split('\n').filter(line => line !== '') : []
  return {
    status: proc.status,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
    stubCalls,
    runnerTempChildPath: toChildPath(runnerTemp),
    githubPathContent: existsSync(githubPath) ? readFileSync(githubPath, 'utf8') : '<github-path file absent>',
    archiveExists: existsSync(join(runnerTemp, `bubblewrap_${PINNED_VERSION}_amd64.deb`)),
    extractionRootExists: existsSync(extractionRoot),
    extractedBwrapExists: existsSync(join(extractionRoot, 'usr', 'bin', 'bwrap')),
  }
}

/** First token of each recorded stub call, e.g. `curl` from `curl --fail ...`. */
const callNames = (result: ScenarioResult): readonly string[] =>
  result.stubCalls.map(line => line.split(' ')[0] ?? '')

const wasCalled = (result: ScenarioResult, stub: string): boolean =>
  result.stubCalls.some(line => line.startsWith(`${stub} `))

describe('prepare-ci-bubblewrap.sh pinned identity (source-level)', () => {
  it('keeps the pinned version, pinned SHA-256, and the verified snapshot URL literal', () => {
    const source = readFileSync(scriptPath, 'utf8')
    expect(source).toContain(`readonly BUBBLEWRAP_VERSION='${PINNED_VERSION}'`)
    expect(source).toContain(`readonly BUBBLEWRAP_SHA256='${PINNED_SHA256}'`)
    const pinnedUrlLine = 'readonly BUBBLEWRAP_URL="https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_' + '${BUBBLEWRAP_VERSION}' + '_amd64.deb"'
    expect(source).toContain(pinnedUrlLine)
  })

  it('checks the digest before extraction', () => {
    const source = readFileSync(scriptPath, 'utf8')
    expect(source).toContain('sha256sum --check --status')
    expect(source.indexOf('sha256sum --check --status')).toBeLessThan(source.indexOf('dpkg-deb --extract'))
  })
})

describe.skipIf(!bashUsable)('prepare-ci-bubblewrap.sh end to end (real script, stubbed external effects)', () => {
  afterAll(() => {
    for (const dir of runDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('succeeds from the verified snapshot source with the pinned identity, in order, once', () => {
    const result = runScenario({ curl: 'ok' })
    expect(result.status).toBe(0)
    expect(result.stdout.match(/bubblewrap functional probe passed/g)).toHaveLength(1)
    expect(result.stdout).toContain('0.9.0')
    const curlCall = result.stubCalls.find(line => line.startsWith('curl '))
    expect(curlCall).toBeDefined()
    expect(curlCall).toContain(PINNED_SNAPSHOT_URL)
    expect(curlCall).toContain('--fail')
    expect(curlCall).toContain('--location')
    expect(curlCall).toContain('--retry 3')
    expect(curlCall).toContain('--retry-all-errors')
    const hashCall = result.stubCalls.find(line => line.startsWith('sha256sum '))
    expect(hashCall).toBeDefined()
    expect(hashCall).toContain('--check --status')
    expect(hashCall).toContain(PINNED_SHA256)
    expect(hashCall).toContain(`bubblewrap_${PINNED_VERSION}_amd64.deb`)
    expect(callNames(result)).toEqual(['uname', 'uname', 'curl', 'sha256sum', 'dpkg-deb', 'sudo', 'bwrap', 'bwrap'])
    expect(result.archiveExists).toBe(true)
    expect(result.extractedBwrapExists).toBe(true)
    expect(result.githubPathContent).toBe(`${result.runnerTempChildPath}/dsh-bubblewrap/usr/bin\n`)
  })

  it('still succeeds when the sysctl knob is absent; the tolerated knob failure is not probe success', () => {
    const result = runScenario({ curl: 'ok', sudoSucceeds: false })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('apparmor userns knob absent')
    expect(result.stdout.match(/bubblewrap functional probe passed/g)).toHaveLength(1)
    expect(wasCalled(result, 'sudo')).toBe(true)
  })

  it('stops at the 404 download with the script exit code and never hashes, extracts, escalates, or probes', () => {
    const result = runScenario({ curl: 'http404' })
    expect(result.status).toBe(22)
    expect(result.stderr).toContain('404')
    expect(wasCalled(result, 'sha256sum')).toBe(false)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.archiveExists).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops at a connection failure with the downloader exit code and never advances a phase', () => {
    const result = runScenario({ curl: 'connfail' })
    expect(result.status).toBe(7)
    expect(wasCalled(result, 'sha256sum')).toBe(false)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a digest mismatch on the pinned identity and never unpacks or publishes a path', () => {
    const result = runScenario({ curl: 'ok', hashMatches: false })
    expect(result.status).toBe(1)
    expect(wasCalled(result, 'sha256sum')).toBe(true)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.extractionRootExists).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops at a failed extraction before any privilege or probe step', () => {
    const result = runScenario({ curl: 'ok', extractSucceeds: false })
    expect(result.status).toBe(2)
    expect(wasCalled(result, 'dpkg-deb')).toBe(true)
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.extractedBwrapExists).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('keeps a functional-probe failure fatal and prints no success line', () => {
    const result = runScenario({ curl: 'ok', probeSucceeds: false })
    expect(result.status).toBe(17)
    expect(result.stdout).not.toContain('bubblewrap functional probe passed')
    expect(result.stubCalls.filter(line => line.startsWith('bwrap '))).toHaveLength(2)
    // The script's existing order appends to GITHUB_PATH before the probe runs;
    // that write is publication, not probe success, and must not be mistaken for one.
    expect(result.githubPathContent).not.toBe('')
  })

  it('refuses a non-Linux host before any download', () => {
    const result = runScenario({ curl: 'ok', unameSys: 'Darwin' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('supports only Linux x86_64')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('refuses a non-x86_64 host before any download', () => {
    const result = runScenario({ curl: 'ok', unameMachine: 'aarch64' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('supports only Linux x86_64')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('fails loud when RUNNER_TEMP is missing, before any download', () => {
    const result = runScenario({ curl: 'ok', dropRunnerTemp: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requires RUNNER_TEMP')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('fails loud when GITHUB_PATH is missing, before any download', () => {
    const result = runScenario({ curl: 'ok', dropGithubPath: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requires GITHUB_PATH')
    expect(wasCalled(result, 'curl')).toBe(false)
  })
})
