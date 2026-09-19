/**
 * Contract fixtures and direct-launch helpers for
 * `scripts/prepare-ci-bubblewrap.spec.ts` (W01/W02, B01-20260919-01).
 *
 * The dpkg-deb control-field contract frozen below comes from the CI evidence
 * of run 35436610274 recorded in `development/delivery-plan/BASELINE.md` §2
 * plus the documented `dpkg-deb --field` behavior: a multi-field request
 * answers with labeled `Field: value` lines in control-file order, never with
 * the bare values the pre-W01 script compared against. The runner log proves
 * the first line (`Package: libcap-dev` — it is quoted verbatim by the
 * script's rejection message); the remaining labeled lines follow the
 * documented multi-field contract for the pinned control file. This host has
 * no real dpkg-deb, so the fixtures freeze the observed shapes for the stub
 * dpkg-deb; real pinned-deb verification is owned by W03 and is not claimed
 * here.
 *
 * The launch helpers (W02) give the spec's Bash child a deterministic
 * environment: a validated absolute Git Bash path, a whitelist env with one
 * canonical `PATH` key in POSIX colon form, and a probed exec-bit capability.
 * They replace the pre-W02 assembly that copied `process.env` wholesale and
 * assigned `env.PATH` on top of it — the combination that produced
 * case-duplicated path variables (`Path` + `PATH`) on Windows runners whose
 * parent stores the OS-canonical `Path`, leaving the winning variable to the
 * mercy of the runner's msys runtime (run 35436610274: 27 scenarios resolved
 * the real host `uname` and stopped at the platform gate).
 */

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Labeled multi-field answer in control-file order with Package first: the
 * byte shape the pre-W01 bulk request received on the failed CI runner.
 */
export const CI_LABELED_CONTROL_PACKAGE_FIRST = [
  'Package: libcap-dev',
  'Version: 1:2.66-5ubuntu2.4',
  'Architecture: amd64',
].join('\n')

/**
 * The same three records in a different order. dpkg-deb orders multi-field
 * output by control-file content, not by request argv, so a reader must not
 * assume any ordering — including this one.
 */
export const CI_LABELED_CONTROL_REORDERED = [
  'Version: 1:2.66-5ubuntu2.4',
  'Architecture: amd64',
  'Package: libcap-dev',
].join('\n')

/**
 * Runner-private libcap library directory of CI run 35445600344. It anchors
 * the provenance of the link-line fixture below and is the prefix the
 * scenario renderer relocates into the run's own private tree.
 */
export const CI_RUNNER_PRIVATE_LIBCAP_LIB = '/home/runner/work/_temp/dsh-bubblewrap-private/libcap/usr/lib/x86_64-linux-gnu'

/**
 * The [7/7] bwrap link command exactly as recorded by CI run 35445600344
 * (job 105903866688, log lines 482/485): Meson links the private static
 * archive as a direct absolute operand with `-Wl,--as-needed
 * -Wl,--no-undefined` and no `-L`/`-lcap` pair at all. The pre-rework link
 * check demanded the `-L`+`-lcap` shape and failed a fully successful link.
 */
export const CI_LINK_LINE_ABSOLUTE_LIBCAP_A = '[7/7] cc  -o bwrap bwrap.p/bubblewrap.c.o bwrap.p/bind-mount.c.o bwrap.p/network.c.o bwrap.p/utils.c.o bwrap.p/chroot_realpath.c.o bwrap.p/safe_openat.c.o -Wl,--as-needed -Wl,--no-undefined /home/runner/work/_temp/dsh-bubblewrap-private/libcap/usr/lib/x86_64-linux-gnu/libcap.a'

/**
 * Renders the CI link line with the private archive operand relocated into
 * a scenario's own private libdir, so the script's check compares against
 * the path that run actually created while every other byte of the recorded
 * line stays frozen.
 * @param privateLibdir Scenario-private libcap library directory.
 * @returns The CI link line with the runner directory replaced.
 */
export const ciAbsoluteLibcapALinkLine = (privateLibdir: string): string =>
  CI_LINK_LINE_ABSOLUTE_LIBCAP_A.replace(
    `${CI_RUNNER_PRIVATE_LIBCAP_LIB}/libcap.a`,
    `${privateLibdir}/libcap.a`,
  )

/** One parent-provided environment variable entry with its stored casing. */
export interface RawEnvEntry {
  readonly name: string
  readonly value: string
}

/** Ordered inputs for the scenario child environment. */
export interface ScenarioEnvInput {
  /**
   * POSIX-form, colon-joinable PATH entries in resolution order: the stub bin
   * directory first, then the host tool directories the real script still
   * needs (Git Bash `/usr/bin` on Windows; none on POSIX, where the parent
   * PATH follows instead).
   */
  readonly pathEntries: readonly string[]
  /**
   * Parent path-variable entries with their stored casing. On win32 their
   * content is never inherited — the whitelist environment is built from
   * `pathEntries` only, so a parent's `Path`/`PATH` duplication cannot reach
   * the child regardless of casing or count. On POSIX only an entry named
   * exactly `PATH` is appended after the explicit entries.
   */
  readonly parentPathEntries: readonly RawEnvEntry[]
  /** Test-owned variables (`STUB_*`, `RUNNER_TEMP`, `GITHUB_PATH`, ...). */
  readonly testVars: Record<string, string>
  readonly platform: NodeJS.Platform
}

/** Resolved launch identity for the spec's Bash child process. */
export interface SpecBash {
  /** Absolute Windows path on win32; the bare `bash` on POSIX hosts. */
  readonly command: string
  /** POSIX-form `/usr/bin` of the Git Bash installation; null on POSIX. */
  readonly usrBinPosix: string | null
  readonly kind: 'git-bash' | 'posix-bash' | 'unavailable'
}

/** Absolute Git Bash candidates probed in order on win32. */
const GIT_BASH_CANDIDATES: readonly string[] = [
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe',
]

/**
 * Converts a drive-absolute Windows path to MSYS POSIX form (`C:\a b` →
 * `/c/a b`). Drive-absolute paths are the only input the spec feeds this
 * (the scenario temp tree and the Git Bash install root); any other input is
 * returned with backslashes turned into slashes.
 * @param windowsPath Drive-absolute Windows path.
 * @returns POSIX-form path usable inside Git Bash.
 */
export const toMsysPosixPath = (windowsPath: string): string => {
  const unified = windowsPath.replaceAll('\\', '/')
  const drive = /^([A-Za-z]):\/(.*)$/.exec(unified)
  return drive ? `/${drive[1]?.toLowerCase()}/${drive[2]}` : unified
}

const validatesAsSpecBash = (command: string): boolean => {
  const proc = spawnSync(command, ['--noprofile', '--norc', '-c', 'printf %s w02-bash-ok'], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  return proc.status === 0 && (proc.stdout ?? '') === 'w02-bash-ok'
}

const isMsysBash = (command: string): boolean => {
  const proc = spawnSync(command, ['--noprofile', '--norc', '-c', 'printf %s "$OSTYPE"'], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  return /^(msys|cygwin)/.test(proc.stdout ?? '')
}

/**
 * Resolves the Bash the scenario children will execute. POSIX hosts use the
 * suite-convention bare `bash`; win32 probes absolute Git Bash candidates
 * (fixed locations, then `%LOCALAPPDATA%`, then `where.exe` output) and
 * accepts the first one that answers a `--noprofile --norc` probe, so no
 * scenario ever depends on how a bare `bash` name happens to resolve.
 * @returns The resolved launch identity, or `unavailable` when no candidate validates.
 */
export const resolveSpecBash = (): SpecBash => {
  if (process.platform !== 'win32') {
    return validatesAsSpecBash('bash')
      ? { command: 'bash', usrBinPosix: null, kind: 'posix-bash' }
      : { command: 'bash', usrBinPosix: null, kind: 'unavailable' }
  }
  const candidates: string[] = [...GIT_BASH_CANDIDATES]
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData !== undefined && localAppData !== '') {
    candidates.push(join(localAppData, 'Programs', 'Git', 'usr', 'bin', 'bash.exe'))
  }
  const systemRoot = process.env.SystemRoot
  if (systemRoot !== undefined && systemRoot !== '') {
    const where = spawnSync(join(systemRoot, 'System32', 'where.exe'), ['bash'], {
      encoding: 'utf8',
      timeout: 10_000,
    })
    candidates.push(...(where.stdout ?? '').split('\n').map(line => line.trim()).filter(line => line !== ''))
  }
  for (const candidate of candidates) {
    if (validatesAsSpecBash(candidate) && isMsysBash(candidate)) {
      return { command: candidate, usrBinPosix: toMsysPosixPath(dirname(candidate)), kind: 'git-bash' }
    }
  }
  return { command: '', usrBinPosix: null, kind: 'unavailable' }
}

/**
 * Builds the scenario child environment as an explicit whitelist: the
 * test-owned variables plus exactly one path variable, named `PATH`, whose
 * value is the colon-joined `pathEntries` (POSIX form on win32; the POSIX
 * parent `PATH` appended after them on other platforms). No parent variable
 * other than the POSIX `PATH` content is inherited, so a parent that stores
 * `Path`, `PATH`, or both can never produce a case-duplicated or
 * parent-poisoned child PATH, and Windows drive-letter paths are never
 * spliced into a colon-separated list.
 * @param input Ordered PATH entries, parent path entries, test vars, platform.
 * @returns The environment for the Bash child process.
 * @throws When `pathEntries` is empty or a test var occupies a path-named key.
 */
export const buildScenarioChildEnv = (input: ScenarioEnvInput): NodeJS.ProcessEnv => {
  if (input.pathEntries.length === 0) {
    throw new Error('buildScenarioChildEnv requires at least one PATH entry (the stub bin)')
  }
  for (const name of Object.keys(input.testVars)) {
    if (name.toLowerCase() === 'path') {
      throw new Error(`buildScenarioChildEnv test var '${name}' collides with the PATH key; pass PATH entries via pathEntries`)
    }
  }
  const env: NodeJS.ProcessEnv = { ...input.testVars }
  if (input.platform === 'win32') {
    env.PATH = input.pathEntries.join(':')
  } else {
    const parentPath = input.parentPathEntries
      .filter(entry => entry.name === 'PATH')
      .map(entry => entry.value)
      .join(':')
    env.PATH = [...input.pathEntries, parentPath].filter(segment => segment !== '').join(':')
  }
  return env
}

/**
 * Probes whether this platform enforces the filesystem exec bit for shebang
 * scripts executed through Bash (a mode-0644 script must fail with status
 * 126 for enforcement to count as present). Git Bash mounts NTFS without ACL
 * enforcement, so Windows hosts answer false and the non-executable-stub
 * regression is skipped there; POSIX CI enforces it.
 * @param bashCommand The validated Bash command the scenarios use.
 * @returns True when a mode-0644 script cannot be executed.
 */
export const probeExecBitEnforcement = (bashCommand: string): boolean => {
  let probeDir: string | undefined
  try {
    probeDir = mkdtempSync(join(tmpdir(), 'dsh-w02-exec-probe-'))
    const script = join(probeDir, 'w02-exec-bit-probe')
    writeFileSync(script, '#!/bin/sh\nexit 0\n')
    chmodSync(script, 0o644)
    const proc = spawnSync(bashCommand, ['--noprofile', '--norc', '-c', script.replaceAll('\\', '/')], {
      encoding: 'utf8',
      timeout: 10_000,
      env: { PATH: toMsysPosixPath(probeDir) },
    })
    return proc.status !== 0 && proc.error === undefined
  } catch {
    return false
  } finally {
    if (probeDir !== undefined) {
      rmSync(probeDir, { recursive: true, force: true })
    }
  }
}
