/**
 * Direct regression for `scripts/prepare-ci-bubblewrap.sh`: the real repository
 * script executes under real Bash while every external effect — `uname`,
 * `curl`, `sha256sum`, `tar`, `dpkg-deb`, `python3` (standing in for Meson
 * setup/compile and placing the stub bwrap into the build directory), `cc`,
 * `ninja`, `pkg-config`, `objdump`, `ldd`, `sudo`, and the built `bwrap` — is
 * a test-owned PATH stub that only records argv and returns scenario-controlled
 * output. No network, toolchain execution, package transaction, sysctl change,
 * or real extraction ever happens: every write lands inside a per-run random
 * temporary directory that `afterAll` removes. A stub "hash match" or
 * "compile" proves control flow only; the real payload identities are the
 * pinned SHA-256 digests verified against the official release assets and
 * Ubuntu's signed archive indexes in the r48 evidence
 * (`development/remediation/2026-09-19/private-bubblewrap-build-r48/`), and
 * the real Linux compile, ELF link, and sandbox probe stay owned by CI.
 *
 * The stub dpkg-deb implements the real `--field` argv protocol (W01): one
 * requested field answers with the bare value line, several answer with
 * labeled control-file-order lines. The labeled block shapes come from the
 * CI-evidence fixtures in `prepare-ci-bubblewrap-test-support.ts`; this
 * Windows host has no real dpkg-deb, so real pinned-deb control-field
 * verification stays owned by W03.
 *
 * Every scenario executes through a validated absolute Git Bash (probed by
 * `resolveSpecBash`, never a bare `bash` name) with `--noprofile --norc`,
 * and inside a whitelist environment built by `buildScenarioChildEnv`: the
 * test-owned variables plus exactly one `PATH` key in POSIX colon form —
 * stub bin first, then Git Bash `/usr/bin` for the coreutils the real script
 * still needs. Windows parent path content (`Path`/`PATH`, semicolon form)
 * is never inherited, so the case-duplicated child environments that let the
 * run-35436610274 runner resolve the real host `uname` cannot recur. Each
 * scenario records its launch evidence — the Bash command used, the
 * `command -v uname` resolution, a per-run stub sentinel log, the spawn
 * error/signal, and stdout/stderr byte counts — and runScenario rejects
 * before the script runs unless `uname` resolves to this run's stub.
 */

import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  CI_LABELED_CONTROL_PACKAGE_FIRST,
  CI_LABELED_CONTROL_REORDERED,
  type RawEnvEntry,
  type ScenarioEnvInput,
  buildScenarioChildEnv,
  ciAbsoluteLibcapALinkLine,
  probeExecBitEnforcement,
  resolveSpecBash,
  toMsysPosixPath,
} from './prepare-ci-bubblewrap-test-support'

// Each scenario spawns the real script as a bash child that executes ~35 stub
// processes; on Windows hosts a full run takes 3-8s, above the 5s default.
vi.setConfig({ testTimeout: 30_000 })

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'prepare-ci-bubblewrap.sh')
const repoRoot = resolve(dirname(scriptPath), '..')

const PINNED_BUBBLEWRAP_VERSION = '0.12.0'
const PINNED_BUBBLEWRAP_SHA256 = '9760d007363e3abba7c747489910f9f82d9fca53ba3bd3282e396fa3c97a3314'
const PINNED_BUBBLEWRAP_URL = `https://github.com/containers/bubblewrap/releases/download/v${PINNED_BUBBLEWRAP_VERSION}/bubblewrap-${PINNED_BUBBLEWRAP_VERSION}.tar.xz`
const PINNED_MESON_VERSION = '1.12.0'
const PINNED_MESON_SHA256 = '88afe0c20e52030218924ac37d0c81c59b4b5f3ae3752c8c6d7470c7d365886c'
const PINNED_MESON_URL = `https://github.com/mesonbuild/meson/releases/download/${PINNED_MESON_VERSION}/meson-${PINNED_MESON_VERSION}.tar.gz`
const PINNED_LIBCAP_VERSION = '1:2.66-5ubuntu2.4'
const PINNED_LIBCAP_SHA256 = '07f2462867569a2119a2ad0f1593232663f2d1612b791c230d22a8d73a15abee'
const PINNED_LIBCAP_ARCHIVE_NAME = 'libcap-dev_2.66-5ubuntu2.4_amd64.deb'
const PINNED_LIBCAP_URL = `https://snapshot.ubuntu.com/ubuntu/20260919T000000Z/pool/main/libc/libcap2/${PINNED_LIBCAP_ARCHIVE_NAME}`
const ROOT_NAME = 'dsh-bubblewrap-private'
const STUB_ARTIFACT_SHA256 = '5f2a19c4a3d8b7e6f0c9d2a1b4e7c8d3f6a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3'

/** Absolute validated launch identity for every scenario's Bash child (W02). */
const specBash = resolveSpecBash()
const bashUsable = specBash.kind !== 'unavailable'
/** True when this platform refuses to execute mode-0644 shebang scripts (false on noacl MSYS mounts). */
const execBitEnforced = bashUsable ? probeExecBitEnforcement(specBash.command) : false
/** The vitest parent's stored path-variable casing, recorded for evidence and used only for the POSIX PATH tail. */
const observedParentPathEntries: readonly RawEnvEntry[] = Object.entries(process.env)
  .filter(([name]) => name.toLowerCase() === 'path')
  .map(([name, value]) => ({ name, value: value ?? '' }))

/** Which pinned input a scenario corrupts. */
type PinnedInput = 'bubblewrap' | 'meson' | 'libcap'

/** The three deb control fields the script reads one-per-invocation (W01). */
type DebField = 'Package' | 'Version' | 'Architecture'

/**
 * Wire shape the stub dpkg-deb serves for a single-field `--field` request.
 * `bare` is the real single-field semantics; the rest replay the CI-evidence
 * failure shapes the script must reject (or, for `no-trailing-lf`, accept).
 */
type DebFieldContract =
  | 'bare'
  | 'no-trailing-lf'
  | 'labeled'
  | 'multi-block'
  | 'multi-block-reordered'
  | 'nonzero-with-correct-output'
  | 'duplicate-record'

/** Which unsafe archive-member class a scenario plants. */
type UnsafeMember = 'traversal-name' | 'absolute-name' | 'symlink-escape' | 'device-member'

interface ScenarioOptions {
  readonly curl?: 'ok' | 'http404' | 'connfail'
  readonly curlFailInput?: PinnedInput
  readonly hashFailInput?: PinnedInput
  readonly unsafeMembers?: UnsafeMember
  readonly unsafeMembersInput?: PinnedInput
  readonly omitTool?: 'ninja' | 'objdump'
  readonly debVersion?: string
  readonly debPackage?: string
  readonly debArch?: string
  readonly debFieldContract?: DebFieldContract
  readonly debMissingField?: DebField
  readonly debOmitStaticLib?: boolean
  readonly debExtractFails?: boolean
  readonly pkgConfigVersion?: string
  readonly mesonSetupFails?: boolean
  readonly mesonCompileFails?: boolean
  readonly linkMode?: 'private' | 'private-absolute-a' | 'host-absolute-a' | 'no-private' | 'host'
  readonly objdumpArchBad?: boolean
  readonly objdumpNeededLibcap?: boolean
  readonly lddLibcap?: boolean
  readonly bwrapVersionOutput?: string
  readonly probeSucceeds?: boolean
  readonly sudoSucceeds?: boolean
  readonly tarExtractFails?: boolean
  readonly unameSys?: string
  readonly unameMachine?: string
  readonly dropRunnerTemp?: boolean
  readonly dropGithubPath?: boolean
  /** Scratch-tree shape: `plain` (default) or a base containing spaces and non-ASCII characters. */
  readonly tempPathShape?: 'plain' | 'space-and-nonascii'
  /** PATH entry order: `stub-first` (default, the guard) or `host-first` (the negative path, win32 only). */
  readonly pathOrder?: 'stub-first' | 'host-first'
  /** Breaks the platform-gate stub: absent from `bin` or present but mode-0644. */
  readonly breakUnameStub?: 'missing' | 'non-executable'
  /** Overrides the observed parent path entries (duplicate-key and casing scenarios). */
  readonly parentPathEntries?: readonly RawEnvEntry[]
}

interface ScenarioResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly stubCalls: readonly string[]
  readonly runnerTempChildPath: string
  readonly githubPathContent: string
  readonly builtBwrapExists: boolean
  readonly privateLibcapPc: string
  readonly mesonToolsDirExists: boolean
  /** The validated Bash command this scenario executed through. */
  readonly bashCommand: string
  /** `command -v uname` inside the same Bash and environment, before the script ran. */
  readonly unameResolution: string
  /** What that probe must resolve to when the stub-source guard is active. */
  readonly expectedUnameResolution: string
  readonly unameProbeStatus: number | null
  /** Unique per-scenario token every stub writes beside its call record. */
  readonly sentinel: string
  /** One `<stub> <sentinel>` line per stub invocation, from this run's stubs only. */
  readonly identityRecords: readonly string[]
  readonly spawnError: string | null
  readonly signal: string | null
  readonly stdoutBytes: number
  readonly stderrBytes: number
}

/** Bash-facing path form: MSYS accepts `C:/...`; POSIX hosts pass through unchanged. */
const toChildPath = (value: string): string => (process.platform === 'win32' ? value.replaceAll('\\', '/') : value)

let plainScratch: string | undefined
let shapedScratch: string | undefined
const runDirs: string[] = []

/** Lazily created per-shape scratch roots; `space-and-nonascii` deliberately contains both. */
const scratchFor = (shape: ScenarioOptions['tempPathShape']): string => {
  if (shape === 'space-and-nonascii') {
    shapedScratch ??= mkdtempSync(join(tmpdir(), 'dsh-w02-准备 probe-'))
    return shapedScratch
  }
  plainScratch ??= mkdtempSync(join(tmpdir(), 'dsh-prepare-ci-bubblewrap-'))
  return plainScratch
}

const BWRAP_LIST_DEFAULT = [
  'bubblewrap-0.12.0/',
  'bubblewrap-0.12.0/meson.build',
  'bubblewrap-0.12.0/meson_options.txt',
  'bubblewrap-0.12.0/bubblewrap.c',
  'bubblewrap-0.12.0/COPYING',
  'bubblewrap-0.12.0/LICENSE',
].join('\n')
const BWRAP_VERBOSE_DEFAULT = [
  'drwxr-xr-x alex/alex 0 2026-08-26 18:09 bubblewrap-0.12.0/',
  '-rw-r--r-- alex/alex 5486 2026-08-26 18:09 bubblewrap-0.12.0/meson.build',
  '-rw-r--r-- alex/alex 815 2026-08-26 18:09 bubblewrap-0.12.0/meson_options.txt',
  '-rw-r--r-- alex/alex 84062 2026-08-26 18:09 bubblewrap-0.12.0/bubblewrap.c',
  '-rw-r--r-- alex/alex 1024 2026-08-26 18:09 bubblewrap-0.12.0/COPYING',
  'lrwxrwxrwx alex/alex 0 2026-08-26 18:09 bubblewrap-0.12.0/LICENSE -> COPYING',
].join('\n')
const MESON_LIST_DEFAULT = [
  'meson-1.12.0/',
  'meson-1.12.0/meson.py',
  'meson-1.12.0/mesonbuild/',
  'meson-1.12.0/mesonbuild/coredata.py',
  'meson-1.12.0/manual tests/',
].join('\n')
const MESON_VERBOSE_DEFAULT = [
  'drwxr-xr-x esr/esr 0 2026-05-30 20:07 meson-1.12.0/',
  '-rw-r--r-- esr/esr 2143 2026-05-30 20:07 meson-1.12.0/meson.py',
  'drwxr-xr-x esr/esr 0 2026-05-30 20:07 meson-1.12.0/mesonbuild/',
  '-rw-r--r-- esr/esr 91000 2026-05-30 20:07 meson-1.12.0/mesonbuild/coredata.py',
  'drwxr-xr-x esr/esr 0 2026-05-30 20:07 meson-1.12.0/manual tests/',
].join('\n')
const DEB_LIST_DEFAULT = [
  './',
  './usr/',
  './usr/include/',
  './usr/include/sys/',
  './usr/include/sys/capability.h',
  './usr/lib/',
  './usr/lib/x86_64-linux-gnu/',
  './usr/lib/x86_64-linux-gnu/libcap.a',
  './usr/lib/x86_64-linux-gnu/libcap.so',
  './usr/lib/x86_64-linux-gnu/pkgconfig/',
  './usr/lib/x86_64-linux-gnu/pkgconfig/libcap.pc',
].join('\n')
const DEB_VERBOSE_DEFAULT = [
  'drwxr-xr-x root/root 0 2026-04-09 23:04 ./',
  '-rw-r--r-- root/root 8681 2026-04-09 23:04 ./usr/include/sys/capability.h',
  '-rw-r--r-- root/root 56650 2026-04-09 23:04 ./usr/lib/x86_64-linux-gnu/libcap.a',
  'lrwxrwxrwx root/root 0 2026-04-09 23:04 ./usr/lib/x86_64-linux-gnu/libcap.so -> libcap.so.2',
  '-rw-r--r-- root/root 211 2026-04-09 23:04 ./usr/lib/x86_64-linux-gnu/pkgconfig/libcap.pc',
].join('\n')

/** Member fixture for one input, with the scenario's unsafe plant applied. */
const fixturesFor = (options: ScenarioOptions): Record<PinnedInput, { list: string; verbose: string }> => {
  const input: PinnedInput = options.unsafeMembersInput ?? 'bubblewrap'
  const tops: Record<PinnedInput, string> = {
    bubblewrap: 'bubblewrap-0.12.0',
    meson: 'meson-1.12.0',
    libcap: './usr/lib/x86_64-linux-gnu',
  }
  const base: Record<PinnedInput, { list: string; verbose: string }> = {
    bubblewrap: { list: BWRAP_LIST_DEFAULT, verbose: BWRAP_VERBOSE_DEFAULT },
    meson: { list: MESON_LIST_DEFAULT, verbose: MESON_VERBOSE_DEFAULT },
    libcap: { list: DEB_LIST_DEFAULT, verbose: DEB_VERBOSE_DEFAULT },
  }
  const target = base[input]
  switch (options.unsafeMembers) {
    case undefined:
      break
    case 'traversal-name':
      target.list = `${target.list}\n../escape`
      break
    case 'absolute-name':
      target.list = `${target.list}\n/etc/passwd`
      break
    case 'symlink-escape':
      target.verbose = `${target.verbose}\nlrwxrwxrwx alex/alex 0 2026-08-26 18:09 ${tops[input]}/evil -> ../../../etc/passwd`
      break
    case 'device-member':
      target.verbose = `${target.verbose}\nbrw-rw---- root/root 0 2026-01-01 00:00 ./dev/sda`
      break
  }
  return base
}

/**
 * Write the stub `bin` directory and run the real script once against it.
 * @param options Scenario knobs for the stub outputs and the child environment.
 * @returns The captured process output plus observable filesystem effects inside the run directory.
 */
const runScenario = (options: ScenarioOptions = {}): ScenarioResult => {
  const runDir = mkdtempSync(join(scratchFor(options.tempPathShape), 'run-'))
  runDirs.push(runDir)
  const bin = join(runDir, 'bin')
  const runnerTemp = join(runDir, 'runner-temp')
  const githubPath = join(runDir, 'github-path')
  const stubLog = join(runDir, 'stub.log')
  const identityLog = join(runDir, 'stub-identity.log')
  mkdirSync(bin)
  mkdirSync(runnerTemp)

  const fixtures = fixturesFor(options)
  const privateLibdir = toChildPath(join(runnerTemp, ROOT_NAME, 'libcap', 'usr', 'lib', 'x86_64-linux-gnu'))

  const stubs: Record<string, string> = {
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
      'out=\'\' url=\'\' prev=\'\'',
      'for arg in "$@"; do',
      '  if [ "$prev" = \'--output\' ]; then out=$arg; fi',
      '  case $arg in https://*) url=$arg ;; esac',
      '  prev=$arg',
      'done',
      'case "$url" in',
      '  "$STUB_URL_BWRAP" | "$STUB_URL_MESON" | "$STUB_URL_LIBCAP") ;;',
      '  *)',
      '    printf \'curl: (22) controlled stub serves only the three pinned sources: %s\\n\' "$url" >&2',
      '    exit 22',
      '    ;;',
      'esac',
      'if [ "$STUB_CURL_MODE" = \'http404\' ] || [ "$STUB_CURL_MODE" = \'connfail\' ]; then',
      '  if [ "$STUB_CURL_MODE" = \'http404\' ]; then printf \'curl: (22) The requested URL returned error: 404\\n\' >&2; exit 22; fi',
      '  printf \'curl: (7) Failed to connect to host\\n\' >&2',
      '  exit 7',
      'fi',
      'case "$url" in',
      '  "$STUB_URL_BWRAP") [ "$STUB_CURL_FAIL_BWRAP" = \'1\' ] && { printf \'curl: (22) controlled per-input failure\\n\' >&2; exit 22; } ;;',
      '  "$STUB_URL_MESON") [ "$STUB_CURL_FAIL_MESON" = \'1\' ] && { printf \'curl: (22) controlled per-input failure\\n\' >&2; exit 22; } ;;',
      '  *) [ "$STUB_CURL_FAIL_LIBCAP" = \'1\' ] && { printf \'curl: (22) controlled per-input failure\\n\' >&2; exit 22; } ;;',
      'esac',
      'printf \'controlled-flow stub payload for %s\\n\' "$url" > "$out"',
      'exit 0',
    ].join('\n') + '\n',
    sha256sum: [
      '#!/bin/sh',
      'printf \'%s\\n\' "sha256sum $*" >> "$STUB_LOG"',
      'case "$*" in',
      '  *--check*)',
      '    input=$(cat)',
      '    case "$input" in',
      '      *bubblewrap-0.12.0.tar.xz*) [ "$STUB_HASH_FAIL_BWRAP" = \'1\' ] && exit 1 ;;',
      '      *meson-1.12.0.tar.gz*) [ "$STUB_HASH_FAIL_MESON" = \'1\' ] && exit 1 ;;',
      '      *libcap-dev_2.66-5ubuntu2.4_amd64.deb*) [ "$STUB_HASH_FAIL_LIBCAP" = \'1\' ] && exit 1 ;;',
      '      *) exit 1 ;;',
      '    esac',
      '    exit 0',
      '    ;;',
      'esac',
      'printf \'%s  %s\\n\' "$STUB_ARTIFACT_SHA256" "$*"',
      'exit 0',
    ].join('\n') + '\n',
    tar: [
      '#!/bin/sh',
      'printf \'%s\\n\' "tar $*" >> "$STUB_LOG"',
      'mode=$1 archive=$2',
      'if [ "$archive" = \'-\' ]; then',
      '    # Drain stdin to EOF before replying: under pipefail the upstream',
      '    # dpkg-deb stub must never write into a closed pipe read end.',
      '    cat > /dev/null',
      '    case "$mode" in',
      '    -tf) printf \'%b\' "$STUB_DEB_LIST" ;;',
      '    -tvf) printf \'%b\' "$STUB_DEB_VERBOSE" ;;',
      '    *) printf \'%s\\n\' \'tar: stub supports -tf/-tvf on stdin\' >&2; exit 2 ;;',
      '  esac',
      '  exit 0',
      'fi',
      'which=unknown',
      'case "$archive" in',
      '  *bubblewrap-0.12.0.tar.xz) which=BWRAP ;;',
      '  *meson-1.12.0.tar.gz) which=MESON ;;',
      '  *) printf \'%s\\n\' "tar: stub refuses unknown archive: $archive" >&2; exit 2 ;;',
      'esac',
      'case "$mode" in',
      '  -tf)',
      '    case "$which" in',
      '      BWRAP) printf \'%b\' "$STUB_TAR_LIST_BWRAP" ;;',
      '      MESON) printf \'%b\' "$STUB_TAR_LIST_MESON" ;;',
      '    esac',
      '    ;;',
      '  -tvf)',
      '    case "$which" in',
      '      BWRAP) printf \'%b\' "$STUB_TAR_VERBOSE_BWRAP" ;;',
      '      MESON) printf \'%b\' "$STUB_TAR_VERBOSE_MESON" ;;',
      '    esac',
      '    ;;',
      '  -xf)',
      '    if [ "$STUB_TAR_EXTRACT_FAIL" = \'1\' ]; then printf \'%s\\n\' \'tar: controlled extraction failure\' >&2; exit 2; fi',
      '    dest=\'\' prev=\'\'',
      '    for arg in "$@"; do',
      '      if [ "$prev" = \'-C\' ]; then dest=$arg; fi',
      '      prev=$arg',
      '    done',
      '    case "$which" in',
      '      BWRAP)',
      '        mkdir -p "$dest/bubblewrap-0.12.0"',
      '        printf \'%s\\n\' \'project("bubblewrap","c")\' > "$dest/bubblewrap-0.12.0/meson.build"',
      '        ;;',
      '      MESON)',
      '        mkdir -p "$dest/meson-1.12.0/mesonbuild"',
      '        printf \'%s\\n\' \'# stub meson entry\' > "$dest/meson-1.12.0/meson.py"',
      '        ;;',
      '    esac',
      '    exit 0',
      '    ;;',
      '  *) printf \'%s\\n\' \'tar: stub supports -tf/-tvf/-xf\' >&2; exit 2 ;;',
      'esac',
      'exit 0',
    ].join('\n') + '\n',
    'dpkg-deb': [
      '#!/bin/sh',
      'printf \'%s\\n\' "dpkg-deb $*" >> "$STUB_LOG"',
      'case "$1" in',
      '  --field)',
      '    # Real dpkg-deb argv protocol (W01): `--field <archive> [field...]`.',
      '    # One requested field answers with the bare value line; several answer',
      '    # with labeled `Field: value` lines in control-file order regardless of',
      '    # argv order — the contract CI run 35436610274 exposed when the pre-W01',
      '    # bulk request received `Package: libcap-dev`.',
      '    shift',
      '    archive=$1',
      '    shift',
      '    pkg="$STUB_DEB_PACKAGE" ver="$STUB_DEB_VERSION" arch="$STUB_DEB_ARCH"',
      '    if [ "$#" -ge 2 ]; then',
      '      printf \'%b\\n\' "$STUB_DEB_LABELED_BLOCK"',
      '      exit 0',
      '    fi',
      '    field=$1',
      '    case "$field" in',
      '      Package) v=$pkg ;;',
      '      Version) v=$ver ;;',
      '      Architecture) v=$arch ;;',
      '      *) v=\'\' ;;',
      '    esac',
      '    [ "$field" != "$STUB_DEB_MISSING_FIELD" ] || v=\'\'',
      '    case "$STUB_DEB_FIELD_CONTRACT" in',
      '      labeled) printf \'%s: %s\\n\' "$field" "$v" ;;',
      '      multi-block) printf \'%b\\n\' "$STUB_DEB_LABELED_BLOCK" ;;',
      '      multi-block-reordered) printf \'%b\\n\' "$STUB_DEB_LABELED_BLOCK_REORDERED" ;;',
      '      duplicate-record) printf \'%s\\n%s\\n\' "$v" "$v" ;;',
      '      no-trailing-lf) printf \'%s\' "$v" ;;',
      '      nonzero-with-correct-output)',
      '        printf \'%s\\n\' "$v"',
      '        printf \'dpkg-deb: controlled field-read failure\\n\' >&2',
      '        exit 2',
      '        ;;',
      '      *) printf \'%s\\n\' "$v" ;;',
      '    esac',
      '    exit 0',
      '    ;;',
      '  --fsys-tarfile)',
      '    printf \'%s\\n\' \'(stub tar stream; the member listing is served by the tar stub fixtures)\'',
      '    ;;',
      '  --extract)',
      '    if [ "$STUB_DPKG_EXTRACT_FAIL" = \'1\' ]; then printf \'%s\\n\' \'dpkg-deb: controlled extraction failure\' >&2; exit 2; fi',
      '    dest=$3',
      '    mkdir -p "$dest/usr/include/sys" "$dest/usr/lib/x86_64-linux-gnu/pkgconfig"',
      '    printf \'%s\\n\' \'cap header\' > "$dest/usr/include/sys/capability.h"',
      '    if [ "$STUB_DPKG_OMIT_STATIC_LIB" != \'1\' ]; then printf \'%s\\n\' \'ar archive stub\' > "$dest/usr/lib/x86_64-linux-gnu/libcap.a"; fi',
      '    printf \'%s\\n\' \'prefix=/usr\' > "$dest/usr/lib/x86_64-linux-gnu/pkgconfig/libcap.pc"',
      '    ln -s libcap.so.2 "$dest/usr/lib/x86_64-linux-gnu/libcap.so" 2>/dev/null || true',
      '    ;;',
      '  *) printf \'%s\\n\' \'dpkg-deb: stub supports --field/--fsys-tarfile/--extract\' >&2; exit 2 ;;',
      'esac',
      'exit 0',
    ].join('\n') + '\n',
    python3: [
      '#!/bin/sh',
      'printf \'%s\\n\' "python3 $*" >> "$STUB_LOG"',
      'if [ "$1" = \'--version\' ]; then printf \'%s\\n\' \'Python 3.12.3\'; exit 0; fi',
      'case "$*" in',
      '  *"meson.py setup"*)',
      '    if [ "$STUB_MESON_SETUP_OK" != \'1\' ]; then printf \'%s\\n\' \'meson.py setup: controlled configure failure\' >&2; exit 1; fi',
      '    exit 0',
      '    ;;',
      '  *"meson.py compile"*)',
      '    if [ "$STUB_MESON_COMPILE_OK" != \'1\' ]; then printf \'%s\\n\' \'meson.py compile: controlled compile failure\' >&2; exit 1; fi',
      '    build=\'\' prev=\'\'',
      '    for arg in "$@"; do',
      '      if [ "$prev" = \'-C\' ]; then build=$arg; fi',
      '      prev=$arg',
      '    done',
      '    mkdir -p "$build"',
      '    cp "$STUB_BWRAP_SRC" "$build/bwrap"',
      '    chmod 755 "$build/bwrap"',
      '    printf \'%s\\n\' "ninja: Entering directory $build"',
      '    case "$STUB_LINK_MODE" in',
      '      no-private) printf \'%s\\n\' \'cc -o bwrap bubblewrap.c.o bind-mount.c.o -O2\' ;;',
      '      host) printf \'%s\\n\' \'cc -o bwrap bubblewrap.c.o bind-mount.c.o -O2 -L/usr/lib/x86_64-linux-gnu -lcap\' ;;',
      '      host-absolute-a) printf \'%s\\n\' \'cc -o bwrap bubblewrap.c.o bind-mount.c.o -Wl,--as-needed -Wl,--no-undefined /usr/lib/x86_64-linux-gnu/libcap.a\' ;;',
      '      private-absolute-a) printf \'%s\\n\' "$STUB_LINK_LINE_ABS_A" ;;',
      '      *) printf \'%s\\n\' "cc -o bwrap bubblewrap.c.o bind-mount.c.o -O2 -L$STUB_PRIVATE_LIBDIR -lcap" ;;',
      '    esac',
      '    exit 0',
      '    ;;',
      'esac',
      'printf \'%s\\n\' \'python3: stub supports --version, meson.py setup, meson.py compile only\' >&2',
      'exit 2',
    ].join('\n') + '\n',
    cc: [
      '#!/bin/sh',
      'printf \'%s\\n\' "cc $*" >> "$STUB_LOG"',
      'printf \'%s\\n\' \'cc (stub) 13.3.0\'',
      'exit 0',
    ].join('\n') + '\n',
    ninja: [
      '#!/bin/sh',
      'printf \'%s\\n\' "ninja $*" >> "$STUB_LOG"',
      'printf \'%s\\n\' 1.11.1',
      'exit 0',
    ].join('\n') + '\n',
    'pkg-config': [
      '#!/bin/sh',
      'printf \'%s\\n\' "pkg-config $*" >> "$STUB_LOG"',
      'case "$*" in',
      '  --version) printf \'%s\\n\' 0.29.2 ;;',
      '  *--modversion*) printf \'%s\\n\' "$STUB_PC_MODVERSION" ;;',
      '  *--variable=libdir*) printf \'%s\\n\' "$STUB_PC_LIBDIR" ;;',
      '  *) printf \'%s\\n\' \'pkg-config: stub supports --version, --modversion, --variable=libdir\' >&2; exit 2 ;;',
      'esac',
      'exit 0',
    ].join('\n') + '\n',
    objdump: [
      '#!/bin/sh',
      'printf \'%s\\n\' "objdump $*" >> "$STUB_LOG"',
      '# Dispatch on $1 exactly: the archive path can contain any option-looking',
      '# substring (a random temp-dir name such as run-fXy9Z8), so whole-argv',
      '# matching would route `objdump -p <run-fXy9Z8/...>` into the -f branch.',
      'case "$1" in',
      '  -f)',
      '    if [ "$STUB_OBJDUMP_ARCH_BAD" = \'1\' ]; then printf \'%s\\n\' \'bwrap:     file format elf64-loongarch64\'; else printf \'%s\\n\' \'bwrap:     file format elf64-x86-64\'; fi',
      '    ;;',
      '  -p)',
      '    printf \'%s\\n\' \'  NEEDED               libc.so.6\'',
      '    if [ "$STUB_OBJDUMP_NEEDED_LIBCAP" = \'1\' ]; then printf \'%s\\n\' \'  NEEDED               libcap.so.2\'; fi',
      '    ;;',
      '  *) printf \'%s\\n\' \'objdump: stub supports exactly -f or -p as the first argument\' >&2; exit 2 ;;',
      'esac',
      'exit 0',
    ].join('\n') + '\n',
    ldd: [
      '#!/bin/sh',
      'printf \'%s\\n\' "ldd $*" >> "$STUB_LOG"',
      'printf \'%s\\n\' \'libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f0000000000)\'',
      'if [ "$STUB_LDD_LIBCAP" = \'1\' ]; then printf \'%s\\n\' \'libcap.so.2 => /lib/x86_64-linux-gnu/libcap.so.2 (0x00007f0000001000)\'; fi',
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
      'if [ "$1" = \'--version\' ]; then printf \'%s\\n\' "$STUB_BWRAP_VERSION_OUT"; exit 0; fi',
      'if [ "$STUB_PROBE_OK" = \'1\' ]; then exit 0; fi',
      'printf \'%s\\n\' \'bwrap: controlled functional-probe failure\' >&2',
      'exit 17',
    ].join('\n') + '\n',
  }
  const sentinel = `w02-${randomUUID().slice(0, 8)}`
  for (const [name, content] of Object.entries(stubs)) {
    if (name === 'ninja' && options.omitTool === 'ninja') continue
    if (name === 'objdump' && options.omitTool === 'objdump') continue
    if (name === 'uname' && options.breakUnameStub === 'missing') continue
    // The identity prelude lands after the shebang: every stub invocation
    // appends `<name> <sentinel>` to this run's identity log, beside the
    // call record in STUB_LOG, so call evidence can be attributed to this
    // run's stub files and never to a stale or host binary.
    const shebangEnd = content.indexOf('\n') + 1
    const withIdentity = `${content.slice(0, shebangEnd)}printf '%s\\n' "${name} $STUB_SENTINEL" >> "$STUB_IDENTITY_LOG"\n${content.slice(shebangEnd)}`
    writeFileSync(join(bin, name), withIdentity)
    chmodSync(join(bin, name), name === 'uname' && options.breakUnameStub === 'non-executable' ? 0o644 : 0o755)
  }

  const stubBinPosix = process.platform === 'win32' ? toMsysPosixPath(bin) : bin
  const hostToolDirsPosix: readonly string[] =
    process.platform === 'win32' && specBash.usrBinPosix !== null ? [specBash.usrBinPosix] : []
  const pathEntries: readonly string[] =
    options.pathOrder === 'host-first'
      ? [...hostToolDirsPosix, stubBinPosix]
      : [stubBinPosix, ...hostToolDirsPosix]

  const testVars: Record<string, string> = {
    STUB_LOG: toChildPath(stubLog),
    STUB_IDENTITY_LOG: toChildPath(identityLog),
    STUB_SENTINEL: sentinel,
    STUB_UNAME_S: options.unameSys ?? 'Linux',
    STUB_UNAME_M: options.unameMachine ?? 'x86_64',
    STUB_CURL_MODE: options.curl ?? 'ok',
    STUB_URL_BWRAP: PINNED_BUBBLEWRAP_URL,
    STUB_URL_MESON: PINNED_MESON_URL,
    STUB_URL_LIBCAP: PINNED_LIBCAP_URL,
    STUB_CURL_FAIL_BWRAP: options.curlFailInput === 'bubblewrap' ? '1' : '',
    STUB_CURL_FAIL_MESON: options.curlFailInput === 'meson' ? '1' : '',
    STUB_CURL_FAIL_LIBCAP: options.curlFailInput === 'libcap' ? '1' : '',
    STUB_HASH_FAIL_BWRAP: options.hashFailInput === 'bubblewrap' ? '1' : '',
    STUB_HASH_FAIL_MESON: options.hashFailInput === 'meson' ? '1' : '',
    STUB_HASH_FAIL_LIBCAP: options.hashFailInput === 'libcap' ? '1' : '',
    STUB_TAR_LIST_BWRAP: fixtures.bubblewrap.list,
    STUB_TAR_VERBOSE_BWRAP: fixtures.bubblewrap.verbose,
    STUB_TAR_LIST_MESON: fixtures.meson.list,
    STUB_TAR_VERBOSE_MESON: fixtures.meson.verbose,
    STUB_DEB_LIST: fixtures.libcap.list,
    STUB_DEB_VERBOSE: fixtures.libcap.verbose,
    STUB_TAR_EXTRACT_FAIL: options.tarExtractFails === true ? '1' : '',
    STUB_DEB_VERSION: options.debVersion ?? PINNED_LIBCAP_VERSION,
    STUB_DEB_PACKAGE: options.debPackage ?? 'libcap-dev',
    STUB_DEB_ARCH: options.debArch ?? 'amd64',
    STUB_DEB_FIELD_CONTRACT: options.debFieldContract ?? 'bare',
    STUB_DEB_MISSING_FIELD: options.debMissingField ?? '',
    STUB_DEB_LABELED_BLOCK: CI_LABELED_CONTROL_PACKAGE_FIRST,
    STUB_DEB_LABELED_BLOCK_REORDERED: CI_LABELED_CONTROL_REORDERED,
    STUB_DPKG_EXTRACT_FAIL: options.debExtractFails === true ? '1' : '',
    STUB_DPKG_OMIT_STATIC_LIB: options.debOmitStaticLib === true ? '1' : '',
    STUB_MESON_SETUP_OK: options.mesonSetupFails === true ? '' : '1',
    STUB_MESON_COMPILE_OK: options.mesonCompileFails === true ? '' : '1',
    STUB_LINK_MODE: options.linkMode ?? 'private',
    STUB_PRIVATE_LIBDIR: privateLibdir,
    STUB_LINK_LINE_ABS_A: ciAbsoluteLibcapALinkLine(privateLibdir),
    STUB_PC_MODVERSION: options.pkgConfigVersion ?? '2.66',
    STUB_PC_LIBDIR: privateLibdir,
    STUB_OBJDUMP_ARCH_BAD: options.objdumpArchBad === true ? '1' : '',
    STUB_OBJDUMP_NEEDED_LIBCAP: options.objdumpNeededLibcap === true ? '1' : '',
    STUB_LDD_LIBCAP: options.lddLibcap === true ? '1' : '',
    STUB_BWRAP_SRC: toChildPath(join(bin, 'bwrap-payload')),
    STUB_BWRAP_VERSION_OUT: options.bwrapVersionOutput ?? `bubblewrap ${PINNED_BUBBLEWRAP_VERSION}`,
    STUB_PROBE_OK: options.probeSucceeds === false ? '0' : '1',
    STUB_SUDO_OK: options.sudoSucceeds === false ? '0' : '1',
    STUB_ARTIFACT_SHA256: STUB_ARTIFACT_SHA256,
    ...(!options.dropRunnerTemp ? { RUNNER_TEMP: toChildPath(runnerTemp) } : {}),
    ...(!options.dropGithubPath ? { GITHUB_PATH: toChildPath(githubPath) } : {}),
  }
  if (!options.dropGithubPath) {
    writeFileSync(githubPath, '')
  }

  const envInput: ScenarioEnvInput = {
    pathEntries,
    parentPathEntries: options.parentPathEntries ?? observedParentPathEntries,
    testVars,
    platform: process.platform,
  }
  const env = buildScenarioChildEnv(envInput)

  // Stub-source check, before the script can invoke anything: `command -v
  // uname` must resolve inside this run's stub bin (the platform gate is the
  // script's first external call). A missing or non-executable stub makes the
  // lookup fall through to the host tool directory — this check rejects that
  // before the script can run against host commands. Only the host-first
  // ordering scenario opts out, to document what the guard prevents.
  const expectedUname = process.platform === 'win32' ? `${stubBinPosix}/uname` : join(bin, 'uname')
  const probe = spawnSync(specBash.command, ['--noprofile', '--norc', '-c', 'command -v uname'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 10_000,
  })
  const unameResolution = (probe.stdout ?? '').trim()
  if (options.pathOrder !== 'host-first' && unameResolution !== expectedUname) {
    throw new Error(
      `stub-source check failed: command -v uname resolved to '${unameResolution}' (probe status ${probe.status}), expected '${expectedUname}'; refusing to run the script against host commands`,
    )
  }

  const proc = spawnSync(specBash.command, ['--noprofile', '--norc', toChildPath(scriptPath)], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  })
  const privateRoot = join(runnerTemp, ROOT_NAME)
  const stubCalls = existsSync(stubLog) ? readFileSync(stubLog, 'utf8').split('\n').filter(line => line !== '') : []
  const identityRecords = existsSync(identityLog)
    ? readFileSync(identityLog, 'utf8').split('\n').filter(line => line !== '')
    : []
  const privatePcPath = join(privateRoot, 'pkgconfig', 'libcap.pc')
  return {
    status: proc.status,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
    stubCalls,
    runnerTempChildPath: toChildPath(runnerTemp),
    githubPathContent: existsSync(githubPath) ? readFileSync(githubPath, 'utf8') : '<github-path file absent>',
    builtBwrapExists: existsSync(join(privateRoot, 'build', 'bwrap')),
    privateLibcapPc: existsSync(privatePcPath) ? readFileSync(privatePcPath, 'utf8') : '<private libcap.pc absent>',
    mesonToolsDirExists: existsSync(join(privateRoot, 'tools', 'meson-1.12.0')),
    bashCommand: specBash.command,
    unameResolution,
    expectedUnameResolution: expectedUname,
    unameProbeStatus: probe.status,
    sentinel,
    identityRecords,
    spawnError: proc.error === undefined ? null : String(proc.error),
    signal: proc.signal ?? null,
    stdoutBytes: Buffer.byteLength(proc.stdout ?? '', 'utf8'),
    stderrBytes: Buffer.byteLength(proc.stderr ?? '', 'utf8'),
  }
}

/** First token of each recorded stub call, e.g. `curl` from `curl --fail ...`. */
const callNames = (result: ScenarioResult): readonly string[] =>
  result.stubCalls.map(line => line.split(' ')[0] ?? '')

const wasCalled = (result: ScenarioResult, stub: string): boolean =>
  result.stubCalls.some(line => line.startsWith(`${stub} `))

const countCalls = (result: ScenarioResult, stub: string): number =>
  result.stubCalls.filter(line => line.startsWith(`${stub} `)).length

const anyCallIncludes = (result: ScenarioResult, fragment: string): boolean =>
  result.stubCalls.some(line => line.includes(fragment))

describe('prepare-ci-bubblewrap.sh pinned identities (source-level)', () => {
  it('keeps the three pinned inputs with publisher-recorded digests and sources', () => {
    const source = readFileSync(scriptPath, 'utf8')
    expect(source).toContain(`readonly BUBBLEWRAP_VERSION='${PINNED_BUBBLEWRAP_VERSION}'`)
    expect(source).toContain(`readonly BUBBLEWRAP_SHA256='${PINNED_BUBBLEWRAP_SHA256}'`)
    expect(source).toContain('readonly BUBBLEWRAP_URL="https://github.com/containers/bubblewrap/releases/download/v${BUBBLEWRAP_VERSION}/bubblewrap-${BUBBLEWRAP_VERSION}.tar.xz"')
    expect(source).toContain(`readonly MESON_VERSION='${PINNED_MESON_VERSION}'`)
    expect(source).toContain(`readonly MESON_SHA256='${PINNED_MESON_SHA256}'`)
    expect(source).toContain('readonly MESON_URL="https://github.com/mesonbuild/meson/releases/download/${MESON_VERSION}/meson-${MESON_VERSION}.tar.gz"')
    expect(source).toContain(`readonly LIBCAP_VERSION='${PINNED_LIBCAP_VERSION}'`)
    expect(source).toContain(`readonly LIBCAP_SHA256='${PINNED_LIBCAP_SHA256}'`)
    expect(source).toContain('readonly LIBCAP_URL="https://snapshot.ubuntu.com/ubuntu/20260919T000000Z/pool/main/libc/libcap2/${LIBCAP_ARCHIVE_NAME}"')
  })

  it('verifies each digest before its archive is unpacked or executed', () => {
    const source = readFileSync(scriptPath, 'utf8')
    expect(source.indexOf('sha256sum --check --status')).toBeLessThan(source.indexOf('tar -xf'))
    expect(source.indexOf('sha256sum --check --status')).toBeLessThan(source.indexOf('dpkg-deb --extract'))
    expect(source.indexOf('fetch_verified "$BUBBLEWRAP_URL" "$BUBBLEWRAP_SHA256" "$bwrap_archive"')).toBeLessThan(
      source.indexOf('extract_tar_verified "$bwrap_archive" "$src_root"'),
    )
    expect(source.indexOf('fetch_verified "$MESON_URL" "$MESON_SHA256" "$meson_archive"')).toBeLessThan(
      source.indexOf('extract_tar_verified "$meson_archive" "$tools_root"'),
    )
    expect(source.indexOf('fetch_verified "$LIBCAP_URL" "$LIBCAP_SHA256" "$libcap_archive"')).toBeLessThan(
      source.indexOf('dpkg-deb --field "$libcap_archive"'),
    )
  })

  it('publishes only after the functional probe passes', () => {
    const source = readFileSync(scriptPath, 'utf8')
    expect(source.indexOf("echo 'bubblewrap functional probe passed'")).toBeLessThan(
      source.indexOf('>> "$GITHUB_PATH"'),
    )
  })

  it('adds no package transaction, no global library path, and no sandbox weakening', () => {
    const source = readFileSync(scriptPath, 'utf8')
    expect(source).not.toContain('apt-get')
    expect(source).not.toContain('LD_LIBRARY_PATH')
    expect(source).not.toContain('--not-a-security-boundary')
    expect(source).not.toContain('setuid')
    expect(source.match(/kernel\.apparmor_restrict_unprivileged_userns/g)).toHaveLength(1)
  })
})

describe.skipIf(!bashUsable)('prepare-ci-bubblewrap.sh end to end (real script, stubbed external effects)', () => {
  afterAll(() => {
    for (const dir of runDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('builds, verifies, and publishes from the three pinned inputs, in order, once', () => {
    const result = runScenario()
    expect(result.status).toBe(0)
    expect(result.stdout.match(/bubblewrap functional probe passed/g)).toHaveLength(1)
    expect(result.stdout).toContain(`bubblewrap ${PINNED_BUBBLEWRAP_VERSION}`)
    expect(result.stdout).toContain('bwrap link command: cc -o bwrap')
    expect(result.stdout).toContain('-lcap')
    expect(result.stdout).toContain('elf64-x86-64')
    expect(result.stdout).toContain(`verified source sha256: bubblewrap-${PINNED_BUBBLEWRAP_VERSION}.tar.xz ${PINNED_BUBBLEWRAP_SHA256}`)
    expect(result.stdout).toContain(`verified build-dependency sha256: meson-${PINNED_MESON_VERSION}.tar.gz ${PINNED_MESON_SHA256}`)
    expect(result.stdout).toContain(`verified build-dependency sha256: ${PINNED_LIBCAP_ARCHIVE_NAME} ${PINNED_LIBCAP_SHA256}`)
    expect(result.stdout).toContain(`built artifact sha256: bwrap ${STUB_ARTIFACT_SHA256}`)
    expect(result.stdout).toContain(`published private-build bubblewrap ${PINNED_BUBBLEWRAP_VERSION}`)
    expect(result.builtBwrapExists).toBe(true)
    expect(result.privateLibcapPc).toContain('Name: libcap')
    expect(result.privateLibcapPc).toContain('Version: 2.66')
    expect(result.mesonToolsDirExists).toBe(true)
    expect(result.githubPathContent).toBe(`${result.runnerTempChildPath}/${ROOT_NAME}/build\n`)
    expect(callNames(result)).toEqual([
      'uname', 'uname', 'python3', 'cc', 'ninja', 'pkg-config',
      'curl', 'sha256sum', 'tar', 'tar', 'tar',
      'curl', 'sha256sum', 'tar', 'tar', 'tar',
      'curl', 'sha256sum', 'dpkg-deb', 'dpkg-deb', 'dpkg-deb', 'dpkg-deb', 'tar', 'dpkg-deb', 'tar', 'dpkg-deb',
      'pkg-config', 'pkg-config', 'python3', 'python3',
      'objdump', 'objdump', 'ldd', 'bwrap', 'sha256sum', 'sudo', 'bwrap',
    ])
  })

  it('still succeeds when the sysctl knob is absent; the tolerated knob failure is not probe success', () => {
    const result = runScenario({ sudoSucceeds: false })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('apparmor userns knob absent')
    expect(result.stdout.match(/bubblewrap functional probe passed/g)).toHaveLength(1)
    expect(wasCalled(result, 'sudo')).toBe(true)
  })

  it('stops at a global 404 with the downloader exit code and never hashes, unpacks, or probes', () => {
    const result = runScenario({ curl: 'http404' })
    expect(result.status).toBe(22)
    expect(result.stderr).toContain('404')
    expect(wasCalled(result, 'sha256sum')).toBe(false)
    expect(wasCalled(result, 'tar')).toBe(false)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops at a connection failure with the downloader exit code', () => {
    const result = runScenario({ curl: 'connfail' })
    expect(result.status).toBe(7)
    expect(wasCalled(result, 'sha256sum')).toBe(false)
    expect(wasCalled(result, 'tar')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops when only the meson download fails, after the bubblewrap input was already verified', () => {
    const result = runScenario({ curlFailInput: 'meson' })
    expect(result.status).toBe(22)
    expect(countCalls(result, 'curl')).toBe(2)
    expect(countCalls(result, 'tar')).toBe(3)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops when only the libcap download fails, after both tarballs were already extracted', () => {
    const result = runScenario({ curlFailInput: 'libcap' })
    expect(result.status).toBe(22)
    expect(countCalls(result, 'curl')).toBe(3)
    expect(countCalls(result, 'tar')).toBe(6)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a bubblewrap digest mismatch and never unpacks anything', () => {
    const result = runScenario({ hashFailInput: 'bubblewrap' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('pinned SHA-256')
    expect(wasCalled(result, 'tar')).toBe(false)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a meson digest mismatch after the bubblewrap extraction but before the meson unpack', () => {
    const result = runScenario({ hashFailInput: 'meson' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('pinned SHA-256')
    expect(countCalls(result, 'tar')).toBe(3)
    expect(result.mesonToolsDirExists).toBe(false)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a libcap digest mismatch before any deb handling', () => {
    const result = runScenario({ hashFailInput: 'libcap' })
    expect(result.status).toBe(1)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a traversal member name in the bubblewrap listing before extraction', () => {
    const result = runScenario({ unsafeMembers: 'traversal-name', unsafeMembersInput: 'bubblewrap' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('escapes the extraction root')
    expect(anyCallIncludes(result, 'tar -xf')).toBe(false)
    expect(countCalls(result, 'curl')).toBe(1)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects an absolute member path in the deb listing before extraction', () => {
    const result = runScenario({ unsafeMembers: 'absolute-name', unsafeMembersInput: 'libcap' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('absolute path')
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a symlink that escapes the extraction root in the meson metadata listing', () => {
    const result = runScenario({ unsafeMembers: 'symlink-escape', unsafeMembersInput: 'meson' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('link escapes the extraction root')
    expect(countCalls(result, 'tar')).toBe(5)
    expect(result.mesonToolsDirExists).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a device member in the deb metadata listing before extraction', () => {
    const result = runScenario({ unsafeMembers: 'device-member', unsafeMembersInput: 'libcap' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('device member')
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('fails loud when a build tool is missing, before any download', () => {
    const result = runScenario({ omitTool: 'ninja' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requires on PATH: ninja')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('rejects a libcap-dev control identity that does not match the pin', () => {
    const result = runScenario({ debVersion: '1:2.66-5ubuntu9' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`control Version is '1:2.66-5ubuntu9', expected '${PINNED_LIBCAP_VERSION}'`)
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a libcap-dev payload without the static library', () => {
    const result = runScenario({ debOmitStaticLib: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('lacks the static library libcap.a')
    expect(anyCallIncludes(result, 'pkg-config --modversion')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops at a deb extraction failure before dependency resolution', () => {
    const result = runScenario({ debExtractFails: true })
    expect(result.status).toBe(2)
    expect(anyCallIncludes(result, 'pkg-config --modversion')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a private libcap that pkg-config resolves to the wrong version', () => {
    const result = runScenario({ pkgConfigVersion: '9.9' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("resolved version '9.9'")
    expect(countCalls(result, 'python3')).toBe(1)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops at a meson configure failure before any compile', () => {
    const result = runScenario({ mesonSetupFails: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('controlled configure failure')
    expect(countCalls(result, 'python3')).toBe(2)
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('stops at a compile failure with no artifact, hash record, probe, or publication', () => {
    const result = runScenario({ mesonCompileFails: true })
    expect(result.status).toBe(1)
    // The compile stub's failure text is merged into the build log by the
    // script's `2>&1 | tee`, so it surfaces on stdout, not stderr.
    expect(result.stdout).toContain('controlled compile failure')
    expect(result.builtBwrapExists).toBe(false)
    expect(result.stdout).not.toContain('built artifact sha256')
    expect(wasCalled(result, 'bwrap')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a link command with no private libcap directory reference', () => {
    const result = runScenario({ linkMode: 'no-private' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not reference the private libcap directory')
    expect(wasCalled(result, 'objdump')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a link command that fell back to the host libcap directory', () => {
    const result = runScenario({ linkMode: 'host' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not reference the private libcap directory')
    expect(result.githubPathContent).toBe('')
  })

  it('accepts the -L plus -lcap private search-path link form (form a)', () => {
    const result = runScenario({ linkMode: 'private' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('bwrap link command: cc -o bwrap')
    expect(result.stdout).toContain('-lcap')
    expect(result.stdout).toContain('published private-build bubblewrap')
    expect(result.githubPathContent).toContain('/build')
  })

  it('accepts the CI-observed absolute private libcap.a operand link form (run 35445600344, form b)', () => {
    const result = runScenario({ linkMode: 'private-absolute-a' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('bwrap link command: [7/7] cc')
    expect(result.stdout).toContain('-Wl,--as-needed -Wl,--no-undefined')
    // The CI line names the archive directly and carries no -lcap pair; the
    // fixture must keep that property or the form stops being form b.
    expect(result.stdout).not.toContain('-lcap')
    expect(result.stdout).toContain('published private-build bubblewrap')
    expect(result.githubPathContent).toContain('/build')
  })

  it('rejects a link command that names the host libcap.a operand', () => {
    const result = runScenario({ linkMode: 'host-absolute-a' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not reference the private libcap directory')
    expect(wasCalled(result, 'objdump')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a built binary that is not an x86-64 ELF', () => {
    const result = runScenario({ objdumpArchBad: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('elf64-x86-64')
    expect(wasCalled(result, 'ldd')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a built binary with a dynamic libcap dependency', () => {
    const result = runScenario({ objdumpNeededLibcap: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dynamic libcap dependency')
    expect(wasCalled(result, 'ldd')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a built binary whose ldd resolves libcap', () => {
    const result = runScenario({ lddLibcap: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('ldd resolves libcap')
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a built binary with the wrong version identity before any probe', () => {
    const result = runScenario({ bwrapVersionOutput: 'bubblewrap 0.11.0' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`expected 'bubblewrap ${PINNED_BUBBLEWRAP_VERSION}'`)
    expect(wasCalled(result, 'sudo')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('keeps a functional-probe failure fatal and publishes nothing', () => {
    const result = runScenario({ probeSucceeds: false })
    expect(result.status).toBe(17)
    expect(result.stdout).not.toContain('bubblewrap functional probe passed')
    expect(result.stdout).not.toContain('published private-build')
    expect(countCalls(result, 'bwrap')).toBe(2)
    expect(result.githubPathContent).toBe('')
  })

  it('refuses a non-Linux host before any download', () => {
    const result = runScenario({ unameSys: 'Darwin' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('supports only Linux x86_64')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('refuses a non-x86_64 host before any download', () => {
    const result = runScenario({ unameMachine: 'aarch64' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('supports only Linux x86_64')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('fails loud when RUNNER_TEMP is missing, before any download', () => {
    const result = runScenario({ dropRunnerTemp: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requires RUNNER_TEMP')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('fails loud when GITHUB_PATH is missing, before any download', () => {
    const result = runScenario({ dropGithubPath: true })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('requires GITHUB_PATH')
    expect(wasCalled(result, 'curl')).toBe(false)
  })

  it('stops at a tarball extraction failure before the next input downloads', () => {
    const result = runScenario({ tarExtractFails: true })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('controlled extraction failure')
    expect(countCalls(result, 'curl')).toBe(1)
    expect(wasCalled(result, 'dpkg-deb')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })
})

describe.skipIf(!bashUsable)('prepare-ci-bubblewrap.sh deb control-field protocol (per-field argv contract)', () => {
  it('reads each control field through its own single-field dpkg-deb call and accepts the pinned identities', () => {
    const result = runScenario()
    expect(result.status).toBe(0)
    const fieldCalls = result.stubCalls.filter(call => call.startsWith('dpkg-deb --field '))
    expect(fieldCalls).toHaveLength(3)
    expect(fieldCalls[0] ?? '').toMatch(/dpkg-deb --field \S+ Package$/)
    expect(fieldCalls[1] ?? '').toMatch(/dpkg-deb --field \S+ Version$/)
    expect(fieldCalls[2] ?? '').toMatch(/dpkg-deb --field \S+ Architecture$/)
    expect(result.stdout).toContain('published private-build bubblewrap')
    expect(result.githubPathContent).toContain('/build')
  })

  it('accepts a legal single-line value whose output ends without a newline', () => {
    const result = runScenario({ debFieldContract: 'no-trailing-lf' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('bubblewrap functional probe passed')
    expect(result.githubPathContent).toContain('/build')
  })

  it('rejects labeled single-field output (the CI run 35436610274 first-failure shape)', () => {
    const result = runScenario({ debFieldContract: 'labeled' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("dpkg-deb --field Package returned labeled output 'Package: libcap-dev'")
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects the labeled multi-field control block when a per-field read receives it', () => {
    const result = runScenario({ debFieldContract: 'multi-block' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dpkg-deb --field Package returned multiple records')
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects the labeled control block in non-argv order identically', () => {
    const result = runScenario({ debFieldContract: 'multi-block-reordered' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dpkg-deb --field Package returned multiple records')
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a field read that exits nonzero even though its stdout is the correct value', () => {
    const result = runScenario({ debFieldContract: 'nonzero-with-correct-output' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dpkg-deb --field Package exited 2')
    expect(result.stderr).toContain('controlled field-read failure')
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it.each(['Package', 'Version', 'Architecture'] as const)(
    'rejects a missing %s control field that returns an empty value with exit 0',
    (field) => {
      const result = runScenario({ debMissingField: field })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`dpkg-deb --field ${field} returned no value`)
      expect(anyCallIncludes(result, '--extract')).toBe(false)
      expect(result.githubPathContent).toBe('')
    },
  )

  it('rejects a duplicate control record line', () => {
    const result = runScenario({ debFieldContract: 'duplicate-record' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dpkg-deb --field Package returned multiple records')
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a wrong Package identity', () => {
    const result = runScenario({ debPackage: 'libcap-dev-bin' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("libcap-dev control Package is 'libcap-dev-bin'")
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })

  it('rejects a wrong Architecture identity', () => {
    const result = runScenario({ debArch: 'arm64' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("libcap-dev control Architecture is 'arm64', expected 'amd64'")
    expect(anyCallIncludes(result, '--extract')).toBe(false)
    expect(result.githubPathContent).toBe('')
  })
})

describe('scenario child environment construction (path-variable uniqueness)', () => {
  const stubBin = '/w02/irrelevant/stub-bin'
  const usrBin = '/c/Program Files/Git/usr/bin'
  const windowsParentPath = 'C:\\Windows\\System32;C:\\Program Files\\dotnet'
  const posixParentPath = '/usr/local/bin:/usr/bin:/bin'

  it('win32: emits exactly one PATH key, stub first, and never inherits parent path content', () => {
    const env = buildScenarioChildEnv({
      pathEntries: [stubBin, usrBin],
      parentPathEntries: [{ name: 'Path', value: windowsParentPath }],
      testVars: { STUB_SENTINEL: 'sentinel-value' },
      platform: 'win32',
    })
    expect(Object.keys(env).filter(name => name.toLowerCase() === 'path')).toEqual(['PATH'])
    expect(env.PATH).toBe(`${stubBin}:${usrBin}`)
    // Windows semicolon lists and drive-letter paths must never be spliced
    // into the colon-separated POSIX PATH the Bash child resolves through.
    expect(env.PATH).not.toContain(';')
    expect(env.PATH).not.toContain('C:')
    expect(Object.keys(env).every(name => name === 'PATH' || name === 'STUB_SENTINEL')).toBe(true)
  })

  it('win32: a parent carrying both Path and PATH (Path first) still yields the same single stub-first PATH', () => {
    const env = buildScenarioChildEnv({
      pathEntries: [stubBin, usrBin],
      parentPathEntries: [
        { name: 'Path', value: windowsParentPath },
        { name: 'PATH', value: 'C:\tools;C:\vendor\bin' },
      ],
      testVars: {},
      platform: 'win32',
    })
    expect(Object.keys(env).filter(name => name.toLowerCase() === 'path')).toEqual(['PATH'])
    expect(env.PATH).toBe(`${stubBin}:${usrBin}`)
  })

  it('win32: a parent carrying both PATH and Path (PATH first) yields the identical single PATH', () => {
    const env = buildScenarioChildEnv({
      pathEntries: [stubBin, usrBin],
      parentPathEntries: [
        { name: 'PATH', value: 'C:\tools;C:\vendor\bin' },
        { name: 'Path', value: windowsParentPath },
      ],
      testVars: {},
      platform: 'win32',
    })
    expect(Object.keys(env).filter(name => name.toLowerCase() === 'path')).toEqual(['PATH'])
    expect(env.PATH).toBe(`${stubBin}:${usrBin}`)
  })

  it('posix: appends the exact parent PATH after the explicit entries and ignores differently-cased variables', () => {
    const env = buildScenarioChildEnv({
      pathEntries: [stubBin],
      parentPathEntries: [
        { name: 'PATH', value: posixParentPath },
        { name: 'Path', value: windowsParentPath },
      ],
      testVars: {},
      platform: 'linux',
    })
    expect(Object.keys(env).filter(name => name.toLowerCase() === 'path')).toEqual(['PATH'])
    expect(env.PATH).toBe(`${stubBin}:${posixParentPath}`)
  })

  it('rejects test vars that occupy a path-named key (misconfiguration fails loud)', () => {
    expect(() =>
      buildScenarioChildEnv({
        pathEntries: [stubBin],
        parentPathEntries: [],
        testVars: { Path: 'C:\\elsewhere' },
        platform: 'win32',
      }),
    ).toThrow(/collides with the PATH key/)
  })
})

describe.skipIf(!bashUsable)('prepare-ci-bubblewrap.sh stub-source identity and launch environment (W02)', () => {
  afterAll(() => {
    for (const dir of runDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('executes through the resolved absolute Bash with a stub-first PATH and records the source evidence', () => {
    const result = runScenario()
    expect(specBash.kind).toBe(process.platform === 'win32' ? 'git-bash' : 'posix-bash')
    if (process.platform === 'win32') {
      expect(result.bashCommand).toMatch(/^[A-Za-z]:\\.*bash\.exe$/)
    } else {
      expect(result.bashCommand).toBe('bash')
    }
    expect(result.status).toBe(0)
    expect(result.spawnError).toBe(null)
    expect(result.signal).toBe(null)
    expect(result.unameProbeStatus).toBe(0)
    expect(result.unameResolution).toBe(result.expectedUnameResolution)
    expect(result.identityRecords).toHaveLength(result.stubCalls.length)
    expect(result.identityRecords.every(line => line.endsWith(result.sentinel))).toBe(true)
    expect(result.identityRecords.some(line => line.startsWith(`uname ${result.sentinel}`))).toBe(true)
    expect(result.stdoutBytes).toBeGreaterThan(0)
    expect(result.stdout).toContain('published private-build bubblewrap')
  })

  it('runs unchanged when the parent environment carries both Path and PATH variants (Path first)', () => {
    const result = runScenario({
      parentPathEntries: [
        { name: 'Path', value: 'C:\\Windows\\System32;C:\\Program Files\\dotnet' },
        { name: 'PATH', value: 'C:\\tools;C:\\vendor\\bin' },
      ],
    })
    expect(result.status).toBe(0)
    expect(result.unameResolution).toBe(result.expectedUnameResolution)
    expect(result.stdout).toContain('published private-build bubblewrap')
    expect(result.githubPathContent).toContain('/build')
  })

  it('runs unchanged when the parent environment carries both PATH and Path variants (PATH first)', () => {
    const result = runScenario({
      parentPathEntries: [
        { name: 'PATH', value: 'C:\\tools;C:\\vendor\\bin' },
        { name: 'Path', value: 'C:\\Windows\\System32;C:\\Program Files\\dotnet' },
      ],
    })
    expect(result.status).toBe(0)
    expect(result.unameResolution).toBe(result.expectedUnameResolution)
    expect(result.stdout).toContain('published private-build bubblewrap')
    expect(result.githubPathContent).toContain('/build')
  })

  it('runs unchanged inside a temporary path containing spaces and non-ASCII characters', () => {
    const result = runScenario({ tempPathShape: 'space-and-nonascii' })
    expect(result.runnerTempChildPath).toContain('准备 probe-')
    expect(result.runnerTempChildPath).toContain(' ')
    expect(result.status).toBe(0)
    expect(result.builtBwrapExists).toBe(true)
    expect(result.githubPathContent).toBe(`${result.runnerTempChildPath}/${ROOT_NAME}/build\n`)
    expect(result.unameResolution).toBe(result.expectedUnameResolution)
    expect(result.stdout).toContain('published private-build bubblewrap')
  })

  describe.skipIf(process.platform !== 'win32')('host tool directory preceding the stub bin', () => {
    it('resolves the real host uname and stops at the platform gate before any stub runs', () => {
      const usrBin = specBash.usrBinPosix ?? ''
      const result = runScenario({ pathOrder: 'host-first' })
      expect(usrBin).not.toBe('')
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('supports only Linux x86_64')
      expect(result.unameResolution).toBe(`${usrBin}/uname`)
      expect(result.stubCalls).toEqual([])
      expect(result.identityRecords).toEqual([])
      expect(result.stdoutBytes).toBe(0)
      expect(result.githubPathContent).toBe('')
    })
  })

  it('refuses to run when the uname stub is missing: the source check rejects the host fallback first', () => {
    let thrown: unknown
    try {
      runScenario({ breakUnameStub: 'missing' })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Error)
    const message = (thrown as Error).message
    expect(message).toMatch(/^stub-source check failed: command -v uname resolved to '.+\/uname'/)
    expect(message).toContain('refusing to run the script against host commands')
    if (process.platform === 'win32') {
      expect(message).toContain(`${specBash.usrBinPosix}/uname`)
    }
  })

  describe.skipIf(!execBitEnforced)('non-executable stub (platform enforces the exec bit)', () => {
    it('refuses to run when the uname stub is present but not executable', () => {
      let thrown: unknown
      try {
        runScenario({ breakUnameStub: 'non-executable' })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(Error)
      const message = (thrown as Error).message
      expect(message).toMatch(/^stub-source check failed: command -v uname resolved to '.+\/uname'/)
      expect(message).toContain('refusing to run the script against host commands')
    })
  })

  it('explains the empty-stdout branch: a stub-driven platform refusal yields empty stdout, not a failed launch', () => {
    const result = runScenario({ unameSys: 'Darwin' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stdoutBytes).toBe(0)
    expect(result.stderrBytes).toBeGreaterThan(0)
    expect(result.stderr).toContain('supports only Linux x86_64')
    expect(result.spawnError).toBe(null)
    expect(result.signal).toBe(null)
    expect(result.unameResolution).toBe(result.expectedUnameResolution)
    expect(result.identityRecords.some(line => line.startsWith(`uname ${result.sentinel}`))).toBe(true)
    expect(result.githubPathContent).toBe('')
  })
})
