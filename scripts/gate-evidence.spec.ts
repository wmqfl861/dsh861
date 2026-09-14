import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  captureBoundedStream,
  EVIDENCE_LOG_CONTENT_BYTES,
  EVIDENCE_LOG_MAX_BYTES,
  exportGateEvidence,
  gateEvidenceRequest,
  gatePathArguments,
  GATE_EVIDENCE_DIR_ENV,
  mirrorProcessOutput,
  resolvePathIdentities,
  sanitizeEvidenceText,
  truncateEvidenceText,
  type GateEvidenceOptions,
} from './gate-evidence.ts'
import { runGate, runGates, type Gate, type GateResult } from './run-gates.ts'

const repoRoot = resolve(import.meta.dirname, '..')

function gate(id: string, options: Partial<Gate> = {}): Gate {
  return {
    id,
    label: id,
    displayCommand: `run ${id}`,
    command: process.execPath,
    args: ['-e', ''],
    ...options,
  }
}

/** A fake environment carrying only the identity allowlist inputs. */
function identityEnvironment(): NodeJS.ProcessEnv {
  return {
    GITHUB_REPOSITORY: 'wmqfl861/dsh861',
    GITHUB_RUN_ID: '34790000001',
    GITHUB_RUN_ATTEMPT: '3',
    GITHUB_JOB: 'node-24-coverage',
    GITHUB_SHA: '1111111111111111111111111111111111111111',
    GITHUB_REF: 'refs/pull/13/merge',
    DSH_GATE_EVIDENCE_PR_NUMBER: '13',
    DSH_GATE_EVIDENCE_PR_HEAD: '2222222222222222222222222222222222222222',
    DSH_GATE_EVIDENCE_PR_BASE: '3333333333333333333333333333333333333333',
  }
}

function emptyCapture(): { text: string; originalBytes: number; omittedBytes: number } {
  return { text: '', originalBytes: 0, omittedBytes: 0 }
}

function exportOptions(overrides: Partial<GateEvidenceOptions> = {}): GateEvidenceOptions {
  return {
    directory: mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-')),
    mode: 'ci-coverage',
    environment: identityEnvironment(),
    root: repoRoot,
    failFast: true,
    maxConcurrency: 2,
    concurrencySource: 'test',
    results: [],
    aggregateStdout: emptyCapture(),
    aggregateStderr: emptyCapture(),
    ...overrides,
  }
}

function readText(absolute: string): string {
  return readFileSync(absolute, 'utf8')
}

function readJson(absolute: string): unknown {
  return JSON.parse(readText(absolute))
}

/** Every file under the evidence directory, recursively, as POSIX paths. */
function listFilesRecursively(directory: string, prefix = ''): string[] {
  const entries: string[] = []
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) entries.push(...listFilesRecursively(directory, relative))
    else entries.push(relative)
  }
  return entries
}

describe('evidence switch', () => {
  it('stays fully disabled while the directory variable is unset or empty', () => {
    expect(gateEvidenceRequest('ci-coverage', {})).toBeUndefined()
    expect(gateEvidenceRequest('ci-coverage', { [GATE_EVIDENCE_DIR_ENV]: '' })).toBeUndefined()
  })

  it('resolves the directory and mode when the switch is set', () => {
    expect(gateEvidenceRequest('ci-consumers', { [GATE_EVIDENCE_DIR_ENV]: '/tmp/evidence' })).toEqual({
      directory: '/tmp/evidence',
      mode: 'ci-consumers',
      environment: { [GATE_EVIDENCE_DIR_ENV]: '/tmp/evidence' },
    })
  })
})

describe('log sanitization', () => {
  it('masks tokens, credentials, cookies, secrets, and personal account paths', () => {
    const raw = [
      'Authorization: Bearer sk-live-abcdef1234567890abcdef',
      'cookie: session=deadbeefdeadbeef; token=xyz',
      'DEEPSEEK_API_KEY="sk-abcdefgh12345678"',
      'password=hunter2extra value',
      'path C:\\Users\\SecretPerson\\project and /home/secretuser/data',
      'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 and github_pat_11ABCDEFGHABCDEFGHIJABCDEFGHIJ1111',
      'AKIAIOSFODNN7EXAMPLE remains',
    ].join('\n')

    const sanitized = sanitizeEvidenceText(raw)

    expect(sanitized).not.toContain('sk-live-abcdef1234567890abcdef')
    expect(sanitized).not.toContain('session=deadbeefdeadbeef')
    expect(sanitized).not.toContain('sk-abcdefgh12345678')
    expect(sanitized).not.toContain('hunter2extra')
    expect(sanitized).not.toContain('SecretPerson')
    expect(sanitized).not.toContain('secretuser')
    expect(sanitized).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456')
    expect(sanitized).not.toContain('github_pat_11ABCDEFGHABCDEFGHIJABCDEFGHIJ1111')
    expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(sanitized).toContain('[REDACTED:credential]')
    expect(sanitized).toContain('[REDACTED:cookie]')
    expect(sanitized).toContain('[REDACTED:secret]')
    expect(sanitized).toContain('[REDACTED:token]')
    expect(sanitized).toContain('[REDACTED:user]')
  })

  it('keeps CI runner account paths readable for diagnosis', () => {
    const sanitized = sanitizeEvidenceText('/home/runner/work/dsh861/dsh861 and D:\\a\\dsh861\\dsh861')

    expect(sanitized).toContain('/home/runner/work/dsh861/dsh861')
    expect(sanitized).toContain('D:\\a\\dsh861\\dsh861')
    expect(sanitized).not.toContain('[REDACTED:user]')
  })
})

describe('bounded capture and truncation', () => {
  it('keeps a head and tail slice with a visible drop notice once the budget is exceeded', () => {
    const subject = captureBoundedStream(1000)
    subject.append('HEAD--'.repeat(50))
    subject.append('MIDDLE--'.repeat(200))
    subject.append('--TAIL')
    const snapshot = subject.read()

    expect(snapshot.originalBytes).toBe(300 + 1600 + 6)
    // Head budget 750, tail budget 250: the 6-byte tail survives and exactly
    // the remainder is reported dropped (1906 - 750 - 6 = 1150).
    expect(snapshot.omittedBytes).toBe(1906 - 750 - 6)
    expect(snapshot.text).toContain('[gate-evidence] capture truncated: omitted 1150 of 1906 raw bytes.')
    // The retained head starts at the stream start and the tail ends at it;
    // the dropped region is the middle beyond the head budget.
    expect(snapshot.text.startsWith('HEAD--')).toBe(true)
    expect(snapshot.text.endsWith('--TAIL')).toBe(true)
    expect(Buffer.byteLength(snapshot.text, 'utf8')).toBeLessThanOrEqual(1000 + 128)
  })

  it('returns the exact text untouched while it fits the budget', () => {
    const subject = captureBoundedStream(1000)
    subject.append('fits')
    const snapshot = subject.read()

    expect(snapshot).toEqual({ text: 'fits', originalBytes: 4, omittedBytes: 0 })
  })

  it('bounds a full text with a notice stating omitted, original, and retained bytes', () => {
    const text = `start=${'x'.repeat(4000)};end`
    const bounded = truncateEvidenceText(text, 1000)

    expect(bounded.truncated).toBe(true)
    expect(bounded.originalBytes).toBeGreaterThan(4000)
    expect(bounded.retainedBytes).toBe(1000)
    expect(bounded.omittedBytes).toBe(bounded.originalBytes - 1000)
    expect(bounded.text).toContain(`[gate-evidence] truncated: retained 750 head + 250 tail of ${bounded.originalBytes} bytes; omitted ${bounded.omittedBytes} bytes.`)
    expect(bounded.text.startsWith('start=')).toBe(true)
    expect(bounded.text.endsWith(';end')).toBe(true)
  })

  it('leaves a within-budget text complete', () => {
    expect(truncateEvidenceText('small', 1000)).toEqual({
      text: 'small',
      truncated: false,
      originalBytes: 5,
      retainedBytes: 5,
      omittedBytes: 0,
    })
  })
})

describe('gate path arguments', () => {
  it('classifies existing repository files and explicitly unmatched path arguments', () => {
    const { existing, missing } = gatePathArguments(repoRoot, [
      'run',
      'vitest',
      '--coverage',
      '--maxWorkers=2',
      process.platform === 'win32' ? 'C:\\private\\pnpm.cjs' : '/private/pnpm.cjs',
      'scripts/run-gates.spec.ts',
      'packages/test-support/loader-smoke/tests/bundled-profile-runtime.e2e.ts',
    ])

    expect(existing).toEqual(['scripts/run-gates.spec.ts'])
    expect(missing).toEqual(['packages/test-support/loader-smoke/tests/bundled-profile-runtime.e2e.ts'])
  })

  it('marks a working-tree file absent from HEAD as unmatched with that reason', () => {
    // The fixture name carries the worker pid because both vitest projects
    // run this spec against the same working tree.
    const fixtureName = `tmp-gate-evidence-untracked-${process.pid}.fixture.ts`
    const untracked = join(repoRoot, fixtureName)
    writeFileSync(untracked, 'export {}\n')
    try {
      const { paths, unmatchedPaths } = resolvePathIdentities(repoRoot, [fixtureName], [])

      expect(paths).toEqual([])
      expect(unmatchedPaths).toEqual([{
        path: fixtureName,
        reason: 'file exists in the working tree but not in the HEAD tree',
      }])
    } finally {
      rmSync(untracked)
    }
  })

  it('resolves the HEAD blob for a tracked file', () => {
    const expected = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD:scripts/run-gates.ts'], { encoding: 'utf8' })
    expect(expected.status).toBe(0)
    const { paths, unmatchedPaths } = resolvePathIdentities(repoRoot, ['scripts/run-gates.ts'], [])

    expect(unmatchedPaths).toEqual([])
    expect(paths).toEqual([{ path: 'scripts/run-gates.ts', blob: (expected.stdout).trim() }])
  })
})

describe('process output mirroring', () => {
  it('captures runner writes on both streams and stops capturing after restore', () => {
    const mirror = mirrorProcessOutput(10_000)
    try {
      process.stdout.write('mirror-stdout-marker\n')
      process.stderr.write('mirror-stderr-marker\n')
      expect(mirror.stdout.read().text).toContain('mirror-stdout-marker')
      expect(mirror.stderr.read().text).toContain('mirror-stderr-marker')
    } finally {
      mirror.restore()
    }
    process.stdout.write('mirror-after-restore\n')
    expect(mirror.stdout.read().text).not.toContain('mirror-after-restore')
    expect(process.stdout.write('restored-write-returns-true\n')).toBe(true)
  })
})

describe('evidence export', () => {
  it('exports faithful statuses, exit codes, logs, identity, and a verifiable manifest', async () => {
    const failing = gate('boom', {
      args: ['-e', "process.stdout.write('boom stdout\\n'); process.stderr.write('boom stderr\\n'); process.exit(3)"],
    })
    const passing = gate('fine')
    const dependent = gate('dependent', { needs: ['boom'] })
    const results = await runGates([dependent, failing, passing], 2, runGate, () => {})
    expect(results.map(result => result.status)).toEqual(['skipped', 'failed', 'passed'])

    const directory = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    const written = exportGateEvidence(exportOptions({
      directory,
      results,
      aggregateStdout: { text: 'aggregate stdout text\n', originalBytes: 22, omittedBytes: 0 },
      aggregateStderr: { text: 'aggregate stderr text\n', originalBytes: 22, omittedBytes: 0 },
    }))

    const files = listFilesRecursively(directory).sort()
    expect(files).toEqual([
      'aggregate-stderr.log',
      'aggregate-stdout.log',
      'gate-results.json',
      'identity.json',
      'logs/boom.log',
      'manifest.json',
    ])

    const manifest = readJson(join(directory, 'manifest.json')) as { files: Array<{ path: string; bytes: number; sha256: string }> }
    // The manifest hashes every exported file except itself; an independent
    // recomputation must match the on-disk bytes exactly.
    expect(manifest.files.map(entry => entry.path).sort()).toEqual(files.filter(file => file !== 'manifest.json'))
    for (const entry of manifest.files) {
      const bytes = readFileSync(join(directory, entry.path))
      expect(entry.bytes).toBe(bytes.byteLength)
      expect(entry.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
    expect(written.map(entry => entry.path)).toContain('manifest.json')

    const gateResults = readJson(join(directory, 'gate-results.json')) as {
      aggregate: string
      failFast: boolean
      summary: { passed: number; failed: number; skipped: number }
      gates: Array<{
        id: string
        displayCommand: string
        status: string
        aborted: boolean
        exitCode: number | null
        signalCode: string | null
        error: string | null
        logFile: string | null
      }>
    }
    expect(gateResults.aggregate).toBe('ci-coverage')
    expect(gateResults.failFast).toBe(true)
    expect(gateResults.summary).toEqual({ passed: 1, failed: 1, skipped: 1 })
    expect(gateResults.gates.map(record => record.id)).toEqual(['dependent', 'boom', 'fine'])
    expect(gateResults.gates[0]).toMatchObject({
      status: 'skipped',
      aborted: false,
      exitCode: null,
      error: 'dependency failed or skipped: boom',
      logFile: null,
    })
    expect(gateResults.gates[1]).toMatchObject({
      status: 'failed',
      aborted: false,
      exitCode: 3,
      signalCode: null,
      displayCommand: 'run boom',
      logFile: 'logs/boom.log',
    })
    expect(gateResults.gates[2]).toMatchObject({ status: 'passed', logFile: null })

    const boomLog = readText(join(directory, 'logs', 'boom.log'))
    expect(boomLog).toContain('<<<stdout>>>\nboom stdout')
    expect(boomLog).toContain('<<<stderr>>>\nboom stderr')
    expect(readText(join(directory, 'aggregate-stdout.log'))).toBe('aggregate stdout text\n')
    expect(readText(join(directory, 'aggregate-stderr.log'))).toBe('aggregate stderr text\n')

    const identity = readJson(join(directory, 'identity.json')) as {
      repository: string
      pr: string
      runId: string
      runAttempt: string
      job: string
      aggregate: string
      prHead: string
      prBase: string
      checkout: { githubSha: string; githubRef: string }
      git: { head: string; headParent: string | null }
      runtime: { node: string; pnpm: string | null; platform: string }
    }
    expect(identity.repository).toBe('wmqfl861/dsh861')
    expect(identity.pr).toBe('13')
    expect(identity.runId).toBe('34790000001')
    expect(identity.runAttempt).toBe('3')
    expect(identity.job).toBe('node-24-coverage')
    expect(identity.aggregate).toBe('ci-coverage')
    // PR head, checkout merge SHA, and the actual Git HEAD are three separate
    // fields and never collapse into one another.
    expect(identity.prHead).toBe('2222222222222222222222222222222222222222')
    expect(identity.prBase).toBe('3333333333333333333333333333333333333333')
    expect(identity.checkout.githubSha).toBe('1111111111111111111111111111111111111111')
    expect(identity.checkout.githubRef).toBe('refs/pull/13/merge')
    const gitHead = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    expect(identity.git.head).toBe((gitHead.stdout).trim())
    expect(identity.git.headParent).not.toBeNull()
    expect(new Set([identity.prHead, identity.checkout.githubSha, identity.git.head]).size).toBe(3)
    expect(identity.runtime.node).toBe(process.versions.node)
    expect(identity.runtime.pnpm).toBeNull()
    expect(identity.runtime.platform).toBe(process.platform)
  }, 20_000)

  it.skipIf(process.platform === 'win32')('records a signal termination as a failed outcome with its signal', async () => {
    const terminated = gate('terminated', { args: ['-e', "process.kill(process.pid, 'SIGTERM')"] })
    const results = await runGates([terminated], 1, runGate, () => {})
    const directory = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    exportGateEvidence(exportOptions({ directory, results }))

    const gateResults = readJson(join(directory, 'gate-results.json')) as {
      gates: Array<{ status: string; signalCode: string | null; exitCode: number | null }>
    }
    expect(gateResults.gates[0]).toMatchObject({ status: 'failed', signalCode: 'SIGTERM', exitCode: null })
  })

  it('keeps a fail-fast aborted gate failed and a skipped gate skipped, never passed', async () => {
    // The literal shapes runGates produces on the fail-fast drain path.
    const aborted: GateResult = {
      gate: gate('aborted-gate'),
      status: 'failed',
      durationMs: 12,
      output: [{ stream: 'stdout', text: 'partial output before abort\n' }],
      exitCode: null,
      signalCode: 'SIGTERM',
      aborted: true,
    }
    const neverRan: GateResult = {
      gate: gate('never-ran'),
      status: 'skipped',
      durationMs: 0,
      output: [],
      exitCode: null,
      signalCode: null,
      error: 'aborted by fail-fast: aborted-gate failed',
    }
    const directory = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    exportGateEvidence(exportOptions({ directory, results: [aborted, neverRan] }))

    const gateResults = readJson(join(directory, 'gate-results.json')) as {
      gates: Array<{ id: string; status: string; aborted: boolean; error: string | null; logFile: string | null }>
    }
    expect(gateResults.gates[0]).toMatchObject({ id: 'aborted-gate', status: 'failed', aborted: true, logFile: 'logs/aborted-gate.log' })
    expect(gateResults.gates[1]).toMatchObject({
      id: 'never-ran',
      status: 'skipped',
      aborted: false,
      error: 'aborted by fail-fast: aborted-gate failed',
      logFile: null,
    })
    expect(readText(join(directory, 'logs', 'aborted-gate.log'))).toContain('partial output before abort')
  })

  it('sanitizes exported gate logs, errors, and aggregate streams end to end', async () => {
    const leaky: GateResult = {
      gate: gate('leaky'),
      status: 'failed',
      durationMs: 5,
      output: [
        { stream: 'stdout', text: 'Authorization: Bearer sk-test-1234567890abcdef\n' },
        { stream: 'stderr', text: 'at C:\\Users\\LeakyPerson\\project\\file.ts:1:1\n' },
      ],
      exitCode: 1,
      signalCode: null,
      error: 'failed to start command: ENOENT C:\\Users\\LeakyPerson\\bin\\tool.exe',
    }
    const directory = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    exportGateEvidence(exportOptions({
      directory,
      results: [leaky],
      aggregateStderr: { text: 'cookie: session=leakysecretvalue1234\n', originalBytes: 34, omittedBytes: 0 },
    }))

    const everything = [
      readText(join(directory, 'logs', 'leaky.log')),
      readText(join(directory, 'gate-results.json')),
      readText(join(directory, 'aggregate-stderr.log')),
    ].join('\n')
    expect(everything).not.toContain('sk-test-1234567890abcdef')
    expect(everything).not.toContain('LeakyPerson')
    expect(everything).not.toContain('leakysecretvalue1234')
    expect(everything).toContain('[REDACTED:credential]')
    expect(everything).toContain('[REDACTED:user]')
    expect(everything).toContain('[REDACTED:cookie]')
  })

  it('makes over-budget output visibly truncated in file and manifest', async () => {
    const big = `first-line\n${'x'.repeat(EVIDENCE_LOG_CONTENT_BYTES + 100_000)}\nlast-line\n`
    const results: GateResult[] = [{
      gate: gate('big'),
      status: 'failed',
      durationMs: 9,
      output: [{ stream: 'stdout', text: big }],
      exitCode: 1,
      signalCode: null,
    }]
    const directory = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    exportGateEvidence(exportOptions({ directory, results }))

    const logPath = join(directory, 'logs', 'big.log')
    const logBytes = readFileSync(logPath)
    expect(logBytes.byteLength).toBeLessThanOrEqual(EVIDENCE_LOG_MAX_BYTES)
    const logText = logBytes.toString('utf8')
    expect(logText).toContain('[gate-evidence] truncated: retained ')
    expect(logText).toContain(' bytes; omitted ')
    expect(logText.startsWith('<<<stdout>>>\nfirst-line')).toBe(true)
    expect(logText.endsWith('last-line\n')).toBe(true)
    const manifest = readJson(join(directory, 'manifest.json')) as {
      files: Array<{ path: string; truncation?: { originalBytes: number; retainedBytes: number; omittedBytes: number } }>
    }
    const entry = manifest.files.find(item => item.path === 'logs/big.log')
    // The exported capture includes the leading stream marker.
    const originalBytes = Buffer.byteLength(`<<<stdout>>>\n${big}`, 'utf8')
    expect(entry?.truncation).toMatchObject({
      originalBytes,
      retainedBytes: EVIDENCE_LOG_CONTENT_BYTES,
    })
    expect(entry?.truncation?.omittedBytes).toBe(originalBytes - EVIDENCE_LOG_CONTENT_BYTES)
  })

  it('confines gate log filenames so path traversal cannot escape the logs directory', async () => {
    const result = (id: string): GateResult => ({
      gate: gate(id),
      status: 'failed',
      durationMs: 1,
      output: [{ stream: 'stdout', text: 'output\n' }],
      exitCode: 1,
      signalCode: null,
    })
    const directory = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    exportGateEvidence(exportOptions({ directory, results: [result('../escape/../../evil'), result('a/b'), result('a_b')] }))

    const files = listFilesRecursively(directory)
    // No path segment anywhere is a parent reference, so every file stays
    // inside the evidence directory the manifest describes.
    expect(files.every(file => !file.split('/').includes('..'))).toBe(true)
    expect(files.filter(file => file.startsWith('logs/')).sort()).toEqual([
      'logs/.._escape_.._.._evil.log',
      'logs/a_b--2.log',
      'logs/a_b.log',
    ])
  })

  it('refuses to export into a non-empty directory, so planted files and symlinks stay out', () => {
    const planted = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    writeFileSync(join(planted, 'foreign.txt'), 'not evidence\n')
    expect(() => exportGateEvidence(exportOptions({ directory: planted }))).toThrow('refusing to export into non-empty directory')

    const linked = mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-'))
    if (process.platform === 'win32') {
      // Windows symlink creation needs a privilege this lane does not assume
      // (an explicitly unproven item); a planted directory proves the same
      // non-empty refusal.
      mkdirSync(join(linked, 'occupied'))
    } else {
      symlinkSync(repoRoot, join(linked, 'planted-link'))
    }
    try {
      expect(() => exportGateEvidence(exportOptions({ directory: linked }))).toThrow('refusing to export into non-empty directory')
    } finally {
      if (process.platform !== 'win32') rmSync(join(linked, 'planted-link'))
    }
  })

  it('rejects when the target path is an existing file, surfacing the export failure', () => {
    const filePath = join(mkdtempSync(join(tmpdir(), 'dsh-gate-evidence-')), 'not-a-directory')
    writeFileSync(filePath, 'file\n')
    expect(() => exportGateEvidence(exportOptions({ directory: filePath }))).toThrow()
  })

  it('records distinct run, attempt, and job identities from the environment', async () => {
    const first = exportOptions({ environment: { ...identityEnvironment(), GITHUB_JOB: 'windows-coverage', GITHUB_RUN_ATTEMPT: '1' } })
    exportGateEvidence(first)
    const second = exportOptions({ environment: { ...identityEnvironment(), GITHUB_JOB: 'node-24-consumers', GITHUB_RUN_ATTEMPT: '2' } })
    exportGateEvidence(second)

    const firstIdentity = readJson(join(first.directory, 'identity.json')) as { job: string; runAttempt: string }
    const secondIdentity = readJson(join(second.directory, 'identity.json')) as { job: string; runAttempt: string }
    expect(firstIdentity).toMatchObject({ job: 'windows-coverage', runAttempt: '1' })
    expect(secondIdentity).toMatchObject({ job: 'node-24-consumers', runAttempt: '2' })
  })
})
