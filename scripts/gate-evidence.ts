/**
 * Opt-in failure-evidence export for gate aggregates.
 *
 * `run-gates.ts` owns scheduling and result observation; this module owns the
 * exported evidence document set: identity, per-gate results, sanitized logs,
 * and a manifest hashing the exact uploaded bytes. Nothing here runs unless
 * {@link GATE_EVIDENCE_DIR_ENV} is set, so an unset switch produces no files
 * and no behavior.
 *
 * Identity reads only an allowlist of non-sensitive CI metadata
 * (`GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `GITHUB_JOB`,
 * `GITHUB_SHA`, `GITHUB_REF`, `npm_config_user_agent`) plus the three explicit
 * {@link GATE_EVIDENCE_PR_NUMBER_ENV}/{@link GATE_EVIDENCE_PR_HEAD_ENV}/
 * {@link GATE_EVIDENCE_PR_BASE_ENV} values the workflow passes. The PR head,
 * the checkout merge SHA, and the actual Git HEAD are recorded as separate
 * fields because `github.sha` is the merge commit for pull-request checkouts,
 * never the PR head. No environment dump, event payload, credential store, or
 * user-directory listing is read or exported.
 * @see ../.agents/notes/implemented/process/2026-09-14-gate-failure-evidence-artifacts.md
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, dirname, join } from 'node:path'
import { runGit } from './translation-pairing-git.ts'
import type { GateResult } from './run-gates.ts'

/** Environment variable naming the directory that enables evidence export. */
export const GATE_EVIDENCE_DIR_ENV = 'DSH_GATE_EVIDENCE_DIR'
/** Environment variable carrying the pull-request number for identity. */
export const GATE_EVIDENCE_PR_NUMBER_ENV = 'DSH_GATE_EVIDENCE_PR_NUMBER'
/** Environment variable carrying the pull-request head SHA for identity. */
export const GATE_EVIDENCE_PR_HEAD_ENV = 'DSH_GATE_EVIDENCE_PR_HEAD'
/** Environment variable carrying the pull-request base SHA for identity. */
export const GATE_EVIDENCE_PR_BASE_ENV = 'DSH_GATE_EVIDENCE_PR_BASE'

/** Hard ceiling on one exported log file, truncation notice included. */
export const EVIDENCE_LOG_MAX_BYTES = 1_048_576
/**
 * Content budget handed to captures and truncation so the always-visible
 * truncation notice and any small masking inflation still fit under
 * {@link EVIDENCE_LOG_MAX_BYTES}.
 */
export const EVIDENCE_LOG_CONTENT_BYTES = EVIDENCE_LOG_MAX_BYTES - 512

/** One retained output stream with raw-byte accounting. */
export interface CapturedOutput {
  /** Retained text: kept head, capture notice when bytes were dropped, kept tail. */
  text: string
  /** Total raw bytes ever appended, before any drop. */
  originalBytes: number
  /** Raw bytes the memory bound dropped before sanitization. */
  omittedBytes: number
}

/** A bounded append-only capture that keeps a head and a tail slice. */
export interface BoundedCapture {
  /** Append one raw chunk; drops middle bytes once the budget is exceeded. */
  append(text: string): void
  /** Pure snapshot of the retained text with drop accounting. */
  read(): CapturedOutput
}

/** Truncation facts recorded beside a truncated log file. */
export interface TruncationFacts {
  originalBytes: number
  retainedBytes: number
  omittedBytes: number
  captureOmittedBytes?: number
}

/** One manifest entry describing an exported file's exact bytes. */
export interface ManifestFileEntry {
  path: string
  bytes: number
  sha256: string
  truncation?: TruncationFacts
}

/** The resolved evidence request; undefined when the switch is unset. */
export interface GateEvidenceRequest {
  /** Directory the evidence files are written to; must be absent or empty. */
  directory: string
  /** Aggregate mode name recorded in identity and gate results. */
  mode: string
  /** Environment the identity metadata is read from. */
  environment: NodeJS.ProcessEnv
}

/** Everything {@link exportGateEvidence} needs from one completed aggregate. */
export interface GateEvidenceOptions extends GateEvidenceRequest {
  /** Repository root for Git metadata and gate path resolution. */
  root: string
  failFast: boolean
  maxConcurrency: number
  concurrencySource: string
  /** Aggregate results in aggregate order; statuses are copied verbatim. */
  results: GateResult[]
  /** Mirrored runner stdout, for gates that stream instead of buffering. */
  aggregateStdout: CapturedOutput
  /** Mirrored runner stderr, for gates that stream instead of buffering. */
  aggregateStderr: CapturedOutput
}

/**
 * Resolve the evidence request from the environment.
 * @param mode - aggregate mode name to record.
 * @param environment - environment to read {@link GATE_EVIDENCE_DIR_ENV} from.
 * @returns the request, or undefined when the switch is unset or empty.
 */
export function gateEvidenceRequest(mode: string, environment: NodeJS.ProcessEnv): GateEvidenceRequest | undefined {
  const directory = environment[GATE_EVIDENCE_DIR_ENV]
  if (directory === undefined || directory === '') return undefined
  return { directory, mode, environment }
}

/**
 * Create one bounded capture keeping the first and last slices of a stream.
 * The drop notice is inserted between the slices at read time and states the
 * omitted and original byte counts, so truncation stays visible in the file.
 * @param maxBytes - content budget for the retained head plus tail.
 * @returns the append/read capture.
 */
export function captureBoundedStream(maxBytes: number): BoundedCapture {
  const headBudget = Math.ceil(maxBytes * 3 / 4)
  const tailBudget = maxBytes - headBudget
  const headChunks: Buffer[] = []
  const tailChunks: Buffer[] = []
  let headBytes = 0
  let tailBytes = 0
  let total = 0
  let dropped = 0
  return {
    append(text: string): void {
      const chunk = Buffer.from(text, 'utf8')
      total += chunk.byteLength
      if (headBytes < headBudget) {
        headChunks.push(chunk)
        headBytes += chunk.byteLength
        return
      }
      tailChunks.push(chunk)
      tailBytes += chunk.byteLength
      while (tailBytes > tailBudget) {
        const first = tailChunks.shift()
        if (first === undefined) break
        const excess = tailBytes - tailBudget
        if (first.byteLength <= excess) {
          tailBytes -= first.byteLength
          dropped += first.byteLength
        } else {
          tailChunks.unshift(first.subarray(excess))
          dropped += excess
          tailBytes -= excess
        }
      }
    },
    read(): CapturedOutput {
      const headRaw = Buffer.concat(headChunks)
      const headCut = Math.max(0, headRaw.byteLength - headBudget)
      const head = headCut === 0 ? headRaw : headRaw.subarray(0, headBudget)
      const tail = Buffer.concat(tailChunks)
      const omitted = dropped + headCut
      const notice = omitted === 0
        ? ''
        : `\n[gate-evidence] capture truncated: omitted ${omitted} of ${total} raw bytes.\n`
      return {
        text: head.toString('utf8') + notice + tail.toString('utf8'),
        originalBytes: total,
        omittedBytes: omitted,
      }
    },
  }
}

/**
 * Mirror the runner's own stdout/stderr writes into bounded captures so gates
 * that stream their output (`streamOutput: true`) still leave evidence. The
 * wrapper only observes writes; it never blocks, reorders, or swallows them,
 * so output ownership and timing are unchanged.
 * @param maxBytes - content budget for each mirrored stream.
 * @returns both captures and the restore function; restore re-installs the
 * original write methods.
 */
export function mirrorProcessOutput(maxBytes = EVIDENCE_LOG_CONTENT_BYTES): {
  stdout: BoundedCapture
  stderr: BoundedCapture
  restore: () => void
} {
  const stdout = captureBoundedStream(maxBytes)
  const stderr = captureBoundedStream(maxBytes)
  const patches = [
    { stream: process.stdout, capture: stdout },
    { stream: process.stderr, capture: stderr },
  ].map(({ stream, capture }) => {
    const original = stream.write.bind(stream)
    stream.write = (chunk: Uint8Array | string) => {
      capture.append(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
      return original(chunk)
    }
    return { stream, original }
  })
  return {
    stdout,
    stderr,
    restore: () => {
      for (const { stream, original } of patches) stream.write = original
    },
  }
}

/** One named masking rule; the placeholder states what class was hidden. */
interface SanitizeRule {
  pattern: RegExp
  replacement: string
}

// Each rule replaces the matched secret-shaped text with a fixed placeholder.
// CI runner accounts (`runner`, `runneradmin` on the hosted images' work
// directories) stay readable because failure diagnosis needs those paths;
// other user segments are masked as personal data.
const SANITIZE_RULES: readonly SanitizeRule[] = [
  {
    pattern: /\b(?:proxy-)?authorization(\s*[:=]\s*)[^\r\n]+/gi,
    replacement: '$1[REDACTED:credential]',
  },
  {
    pattern: /\bbearer\s+[\w.~+/=-]{8,}/gi,
    replacement: 'bearer [REDACTED:credential]',
  },
  {
    pattern: /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g,
    replacement: '[REDACTED:token]',
  },
  {
    pattern: /\b(?:set-)?cookie\s*:\s*[^\r\n]+/gi,
    replacement: 'cookie: [REDACTED:cookie]',
  },
  {
    // The key may be bare or an identifier suffix (DEEPSEEK_API_KEY); the
    // case-insensitive match keeps the key and masks only the value.
    pattern: /(^|[\s"'&])(\w*(?:password|passwd|secret|token|api[_-]?key|credential)\w*)(\s*[:=]\s*)(["']?)[^\s"']+\4/gi,
    replacement: '$1$2$3$4[REDACTED:secret]$4',
  },
  {
    pattern: /(\busers[\\/]+|\/home\/)(?!runner[\\/])([^\\/"\s']+)/gi,
    replacement: '$1[REDACTED:user]',
  },
]

/**
 * Mask secret-shaped and personal content in gate or runner output text.
 * Applied before any byte is written or hashed, so the manifest hashes only
 * sanitized bytes and unmasked raw text is never uploaded.
 * @param text - raw output text.
 * @returns the text with every rule's matches replaced by fixed placeholders.
 */
export function sanitizeEvidenceText(text: string): string {
  let sanitized = text
  for (const rule of SANITIZE_RULES) sanitized = sanitized.replace(rule.pattern, rule.replacement)
  return sanitized
}

/**
 * Bound one log text to a byte budget, keeping the head (where the first
 * failure appears) and a tail summary, with a notice stating the omitted,
 * original, and retained byte counts between them. A truncated file is never
 * presented as the complete original.
 * @param text - sanitized log text.
 * @param maxBytes - byte budget for the retained head plus tail.
 * @returns the final text (notice included when truncated) and the truncation
 * facts for the manifest.
 */
export function truncateEvidenceText(text: string, maxBytes: number): {
  text: string
  truncated: boolean
  originalBytes: number
  retainedBytes: number
  omittedBytes: number
} {
  const originalBytes = Buffer.byteLength(text, 'utf8')
  if (originalBytes <= maxBytes) {
    return { text, truncated: false, originalBytes, retainedBytes: originalBytes, omittedBytes: 0 }
  }
  const headBytes = Math.ceil(maxBytes * 3 / 4)
  const tailBytes = maxBytes - headBytes
  const buffer = Buffer.from(text, 'utf8')
  const head = buffer.subarray(0, headBytes).toString('utf8')
  const tail = buffer.subarray(originalBytes - tailBytes).toString('utf8')
  const omitted = originalBytes - headBytes - tailBytes
  const notice = `\n[gate-evidence] truncated: retained ${headBytes} head + ${tailBytes} tail of ${originalBytes} bytes; omitted ${omitted} bytes.\n`
  return {
    text: head + notice + tail,
    truncated: true,
    originalBytes,
    retainedBytes: headBytes + tailBytes,
    omittedBytes: omitted,
  }
}

/**
 * Collect repository-relative path-like gate arguments. A token is path-like
 * when it is relative, flag-free, and ends in a dotted extension; the
 * `pnpm` entrypoint argument is absolute and therefore never a candidate.
 * @param root - repository root for existence checks.
 * @param args - one gate's argument list.
 * @returns the tokens that exist as files and the path-like tokens that do not.
 */
export function gatePathArguments(root: string, args: readonly string[]): {
  existing: string[]
  missing: string[]
} {
  const existing: string[] = []
  const missing: string[] = []
  for (const arg of args) {
    if (arg === '' || arg.startsWith('-') || arg.includes('=') || isAbsolute(arg)) continue
    if (!/^[\w][\w./\\-]*\.[A-Za-z0-9]+$/.test(arg)) continue
    const normalized = arg.replaceAll('\\', '/')
    let isFile = false
    try {
      isFile = statSync(join(root, normalized)).isFile()
    } catch {
      isFile = false
    }
    if (isFile) existing.push(normalized)
    else missing.push(normalized)
  }
  return { existing, missing }
}

interface GitIdentity {
  head: string | null
  headParent: string | null
  error?: string
}

function readGitIdentity(root: string): GitIdentity {
  try {
    const head = runGit(root, ['rev-parse', 'HEAD'], 'resolving evidence HEAD').toString('utf8').trim()
    const parents = runGit(root, ['show', '-s', '--format=%P', '-n1', 'HEAD'], 'resolving evidence HEAD parent')
      .toString('utf8')
      .trim()
      .split(' ')
      .filter(Boolean)
    return { head, headParent: parents[0] ?? null }
  } catch (error) {
    return { head: null, headParent: null, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Resolve blob identities for existing gate paths at the actual Git HEAD, and
 * classify path-like arguments that are absent from the working tree or the
 * HEAD tree as explicitly unmatched.
 * @param root - repository root for Git.
 * @param existing - normalized repository-relative existing paths.
 * @param missing - normalized path-like arguments with no working-tree file.
 * @returns per-path blob records and unmatched records with reasons.
 */
export function resolvePathIdentities(root: string, existing: readonly string[], missing: readonly string[]): {
  paths: Array<{ path: string; blob: string | null }>
  unmatchedPaths: Array<{ path: string; reason: string }>
} {
  const paths: Array<{ path: string; blob: string | null }> = []
  const unmatchedPaths = missing.map(path => ({ path, reason: 'no such file in the working tree' }))
  if (existing.length === 0) return { paths, unmatchedPaths }
  let entries: Map<string, string> | undefined
  let gitError: string | undefined
  try {
    const output = runGit(root, ['ls-tree', 'HEAD', '-z', '--', ...existing], 'resolving evidence path blobs')
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
    entries = new Map()
    for (const entry of output) {
      const match = /^\d+ \w+ ([0-9a-f]{40})\t([\s\S]+)$/.exec(entry)
      if (match?.[1] !== undefined && match[2] !== undefined) entries.set(match[2], match[1])
    }
  } catch (error) {
    gitError = error instanceof Error ? error.message : String(error)
  }
  for (const path of existing) {
    const blob = entries?.get(path)
    if (blob !== undefined) paths.push({ path, blob })
    else {
      unmatchedPaths.push({
        path,
        reason: gitError ?? 'file exists in the working tree but not in the HEAD tree',
      })
    }
  }
  return { paths, unmatchedPaths }
}

function pnpmVersion(environment: NodeJS.ProcessEnv): string | null {
  const userAgent = environment.npm_config_user_agent
  if (userAgent === undefined || userAgent === '') return null
  const match = /pnpm\/(\S+)/.exec(userAgent)
  return match?.[1] ?? null
}

function buildIdentity(options: GateEvidenceOptions, git: GitIdentity): Record<string, unknown> {
  const environment = options.environment
  return {
    repository: environment.GITHUB_REPOSITORY ?? null,
    pr: environment[GATE_EVIDENCE_PR_NUMBER_ENV] ?? null,
    runId: environment.GITHUB_RUN_ID ?? null,
    runAttempt: environment.GITHUB_RUN_ATTEMPT ?? null,
    job: environment.GITHUB_JOB ?? null,
    aggregate: options.mode,
    prHead: environment[GATE_EVIDENCE_PR_HEAD_ENV] ?? null,
    prBase: environment[GATE_EVIDENCE_PR_BASE_ENV] ?? null,
    checkout: {
      githubSha: environment.GITHUB_SHA ?? null,
      githubRef: environment.GITHUB_REF ?? null,
    },
    git: {
      head: git.head,
      headParent: git.headParent,
      ...(git.error === undefined ? {} : { error: git.error }),
    },
    runtime: {
      node: process.versions.node,
      pnpm: pnpmVersion(environment),
      platform: process.platform,
      arch: process.arch,
    },
    exportedAt: new Date().toISOString(),
  }
}

interface GateRecord {
  id: string
  label: string
  displayCommand: string
  status: GateResult['status']
  aborted: boolean
  allowFailure: boolean
  durationMs: number
  exitCode: number | null
  signalCode: NodeJS.Signals | null
  error: string | null
  logFile: string | null
  paths: Array<{ path: string; blob: string | null }>
  unmatchedPaths: Array<{ path: string; reason: string }>
}

/**
 * Render one buffered gate's output as a single log body that preserves the
 * stdout/stderr distinction: each run of consecutive same-stream chunks is
 * wrapped in a stream marker so the streams stay separable in the artifact.
 * @param output - the gate's retained output chunks in arrival order.
 * @returns the combined log body.
 */
function renderGateOutput(output: ReadonlyArray<{ stream: 'stdout' | 'stderr'; text: string }>): string {
  const parts: string[] = []
  let current: 'stdout' | 'stderr' | undefined
  for (const chunk of output) {
    if (chunk.stream !== current) {
      parts.push(`<<<${chunk.stream}>>>\n`)
      current = chunk.stream
    }
    parts.push(chunk.text)
  }
  return parts.join('')
}

/** A gate log is exported only for gates whose outcome was not a pass. */
function gateNeedsLog(result: GateResult): boolean {
  return result.output.length > 0 && (result.status === 'failed' || result.aborted === true)
}

/**
 * Assemble the final bytes of one log file: sanitize the retained capture,
 * bound it to the content budget, and derive the manifest truncation facts.
 * @param capture - the retained raw text with drop accounting.
 * @returns the file buffer and its truncation facts when content was dropped.
 */
function buildLogBuffer(capture: CapturedOutput): { buffer: Buffer; truncation?: TruncationFacts } {
  const sanitized = sanitizeEvidenceText(capture.text)
  const bounded = truncateEvidenceText(sanitized, EVIDENCE_LOG_CONTENT_BYTES)
  if (!bounded.truncated && capture.omittedBytes === 0) {
    return { buffer: Buffer.from(bounded.text, 'utf8') }
  }
  return {
    buffer: Buffer.from(bounded.text, 'utf8'),
    truncation: {
      originalBytes: capture.originalBytes,
      retainedBytes: bounded.retainedBytes,
      omittedBytes: capture.originalBytes - bounded.retainedBytes,
      ...(capture.omittedBytes > 0 ? { captureOmittedBytes: capture.omittedBytes } : {}),
    },
  }
}

function evidenceFileName(gateId: string, used: Set<string>): string {
  const base = `${gateId.replaceAll(/[^A-Za-z0-9._-]/g, '_')}.log`
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base.replace(/\.log$/u, '')}--${suffix}.log`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

/**
 * Export the complete evidence document set for one finished aggregate.
 *
 * Writes `identity.json`, `gate-results.json`, per-gate logs under `logs/`
 * for non-passing gates with retained output, the mirrored aggregate streams,
 * and `manifest.json` hashing the exact written bytes. The directory must be
 * absent or empty, and the final listing must equal the written set, so no
 * foreign file or symlink can enter the upload. Export errors throw; the
 * caller reports them without touching the aggregate's own exit code.
 * @param options - the completed aggregate's evidence inputs.
 * @returns the written manifest entries.
 */
export function exportGateEvidence(options: GateEvidenceOptions): ManifestFileEntry[] {
  const directory = options.directory
  mkdirSync(directory, { recursive: true })
  const preExisting = readdirSync(directory)
  if (preExisting.length > 0) {
    throw new Error(`gate evidence: refusing to export into non-empty directory ${JSON.stringify(directory)}.`)
  }
  const git = readGitIdentity(options.root)
  const written: ManifestFileEntry[] = []
  const usedLogNames = new Set<string>()
  const emit = (relativePath: string, buffer: Buffer, truncation?: TruncationFacts): void => {
    const absolute = join(directory, relativePath)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, buffer)
    const onDisk = readFileSync(absolute)
    if (!onDisk.equals(buffer)) {
      throw new Error(`gate evidence: written file ${JSON.stringify(relativePath)} does not match the hashed bytes.`)
    }
    written.push({
      path: relativePath,
      bytes: onDisk.byteLength,
      sha256: createHash('sha256').update(onDisk).digest('hex'),
      ...(truncation === undefined ? {} : { truncation }),
    })
  }
  const emitLog = (relativePath: string, capture: CapturedOutput): void => {
    const { buffer, truncation } = buildLogBuffer(capture)
    emit(relativePath, buffer, truncation)
  }

  const gates: GateRecord[] = options.results.map((result) => {
    const { existing, missing } = gatePathArguments(options.root, result.gate.args)
    const { paths, unmatchedPaths } = resolvePathIdentities(options.root, existing, missing)
    let logFile: string | null = null
    if (gateNeedsLog(result)) {
      const rendered = renderGateOutput(result.output)
      logFile = `logs/${evidenceFileName(result.gate.id, usedLogNames)}`
      emitLog(logFile, {
        text: rendered,
        originalBytes: Buffer.byteLength(rendered, 'utf8'),
        omittedBytes: 0,
      })
    }
    return {
      id: result.gate.id,
      label: result.gate.label,
      displayCommand: result.gate.displayCommand,
      status: result.status,
      aborted: result.aborted === true,
      allowFailure: result.gate.allowFailure === true,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      signalCode: result.signalCode,
      error: result.error === undefined ? null : sanitizeEvidenceText(result.error),
      logFile,
      paths,
      unmatchedPaths,
    }
  })

  const json = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
  emit('identity.json', json(buildIdentity(options, git)))
  emit('gate-results.json', json({
    aggregate: options.mode,
    failFast: options.failFast,
    maxConcurrency: options.maxConcurrency,
    concurrencySource: options.concurrencySource,
    summary: {
      passed: options.results.filter(result => result.status === 'passed').length,
      failed: options.results.filter(result => result.status === 'failed').length,
      skipped: options.results.filter(result => result.status === 'skipped').length,
    },
    gates,
  }))
  emitLog('aggregate-stdout.log', options.aggregateStdout)
  emitLog('aggregate-stderr.log', options.aggregateStderr)
  emit('manifest.json', json({
    artifactScope: 'gate failure evidence',
    generatedAt: new Date().toISOString(),
    files: written,
  }))

  const finalListing = listFilesRecursive(directory).sort()
  const writtenListing = written.map(entry => entry.path).sort()
  if (finalListing.join('\0') !== writtenListing.join('\0')) {
    throw new Error('gate evidence: final directory listing does not equal the written file set.')
  }
  return written
}

/** Every regular file under `directory`, as POSIX-style relative paths. */
function listFilesRecursive(directory: string, prefix = ''): string[] {
  const entries: string[] = []
  for (const item of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix === '' ? item.name : `${prefix}/${item.name}`
    if (item.isDirectory()) entries.push(...listFilesRecursive(directory, relative))
    else entries.push(relative)
  }
  return entries
}
