import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_ROOT = 'D:/Temp_projects/dsh861-p0-b-harness-validation'
const HARNESS_NAMES = ['codex', 'claude-code', 'opencode', 'grok'] as const
const CASE_NAMES = ['allow', 'deny'] as const
const VALUE_OPTIONS = new Set(['harness', 'case', 'root'])
const FLAG_OPTIONS = new Set(['source', 'artifact', 'expect-denied', 'require-real-product'])

type HarnessName = typeof HARNESS_NAMES[number]
type CaseName = typeof CASE_NAMES[number]
type RunMode = 'source' | 'artifact'
type RunStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN'

interface Arguments {
  harness: HarnessName
  caseName: CaseName
  mode: RunMode
  expectDenied: boolean
  requireRealProduct: boolean
  root: string
}

interface DirectoryRecord {
  root: string
  config: string
  authReference: string
  home: string
  cache: string
  session: string
  logs: string
  work: string
  bait: string
  artifacts: string
  process: string
  raw: string
}

interface Observation<T> {
  value: T
  status: 'OBSERVED' | 'UNKNOWN'
  reason?: string
}

/** Serializable legacy evidence emitted by the adapterless B2 foundation. */
export interface HarnessEvidence {
  node: 'P0-B'
  planVersion: 'v1'
  harness: HarnessName
  case: CaseName
  mode: RunMode
  status: RunStatus
  runId: string
  requireRealProduct: boolean
  expectDenied: boolean
  program: Observation<{ absolutePath?: string; argv: string[] }>
  version: Observation<string>
  command: { argv: string[]; argvSha256: string }
  environment: { names: string[]; secretValuesRecorded: false }
  directories: DirectoryRecord
  permissions: { requested: string; observed: 'UNKNOWN'; reason: string }
  tools: { visible: string[]; callable: string[]; allowed: string[]; denied: string[]; status: 'UNKNOWN'; reason: string }
  process: { before: unknown[]; during: unknown[]; after: unknown[]; quiescent: 'NOT_RUN'; reason: string }
  filesystem: { before: unknown[]; after: unknown[]; allowedTarget: string; baitTarget: string; status: 'NOT_RUN'; reason: string }
  session: Observation<{ parent?: string; product?: string; path?: string }>
  handoff: Observation<{ path?: string; artifactSha256?: string }>
  artifacts: { paths: string[]; sha256: string[] }
  usage: Observation<unknown>
  native: Observation<unknown>
  blockedConditions: string[]
  timestamps: { startedAt: string; finishedAt: string }
  cleanup: { rootRemoved: boolean; ownedResourcesOnly: true }
}

function fail(message: string): never {
  throw new Error(`validate-harness: ${message}`)
}

function oneOf<T extends string>(value: string | undefined, values: readonly T[], name: string): T {
  if (value === undefined || !values.includes(value as T)) fail(`${name} must be one of ${values.join(', ')}`)
  return value as T
}

function parseArguments(argv: readonly string[]): Arguments {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  const seen = new Set<string>()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === undefined || !argument.startsWith('--')) fail('unexpected positional argument')
    const equal = argument.indexOf('=')
    const name = argument.slice(2, equal === -1 ? undefined : equal)
    // Do not echo unknown argument contents: an accidental argument may be a secret.
    if (!VALUE_OPTIONS.has(name) && !FLAG_OPTIONS.has(name)) fail('unknown option')
    if (seen.has(name)) fail(`duplicate --${name}`)
    seen.add(name)
    if (FLAG_OPTIONS.has(name)) {
      if (equal !== -1) fail(`--${name} does not accept a value`)
      flags.add(name)
      continue
    }
    const value = equal === -1 ? argv[++index] : argument.slice(equal + 1)
    if (value === undefined || value.length === 0 || value.startsWith('--')) fail(`missing value for --${name}`)
    values.set(name, value)
  }
  const harness = oneOf(values.get('harness'), HARNESS_NAMES, '--harness')
  const caseName = oneOf(values.get('case'), CASE_NAMES, '--case')
  if (flags.has('source') === flags.has('artifact')) fail('exactly one of --source or --artifact is required')
  if (flags.has('expect-denied') && caseName !== 'deny') fail('--expect-denied requires --case deny')
  const root = values.get('root') ?? DEFAULT_ROOT
  if (!isAbsolute(root)) fail('--root must be absolute; non-Windows hosts must supply --root')
  return {
    harness, caseName, mode: flags.has('source') ? 'source' : 'artifact',
    expectDenied: flags.has('expect-denied'), requireRealProduct: flags.has('require-real-product'),
    root: resolve(root),
  }
}

function directories(runRoot: string): DirectoryRecord {
  const result: DirectoryRecord = {
    root: runRoot, config: join(runRoot, 'config'), authReference: join(runRoot, 'auth-reference'),
    home: join(runRoot, 'home'), cache: join(runRoot, 'cache'), session: join(runRoot, 'session'),
    logs: join(runRoot, 'logs'), work: join(runRoot, 'work'), bait: join(runRoot, 'bait'),
    artifacts: join(runRoot, 'artifacts'), process: join(runRoot, 'process'), raw: join(runRoot, 'raw'),
  }
  for (const path of Object.values(result)) mkdirSync(path, { recursive: true })
  return result
}

function blockedEvidence(args: Arguments, runRoot: string, startedAt: string): HarnessEvidence {
  const dirs = directories(runRoot)
  const argv = ['<real-adapter-unregistered>', args.harness, args.caseName, args.mode]
  const reason = 'No real product process was started.'
  const blockedConditions = [
    `No registered real ${args.harness} adapter is available in B2.`,
    'No product process was started; no allow or deny operation was observed.',
    'A real product credential, protocol and external observation are required before PASS.',
  ]
  if (args.requireRealProduct) blockedConditions.push('--require-real-product cannot be satisfied by the adapterless B2 foundation.')
  return {
    node: 'P0-B', planVersion: 'v1', harness: args.harness, case: args.caseName, mode: args.mode,
    status: 'BLOCKED', runId: basename(runRoot), requireRealProduct: args.requireRealProduct,
    expectDenied: args.expectDenied,
    program: { value: { argv }, status: 'UNKNOWN', reason },
    version: { value: 'UNKNOWN', status: 'UNKNOWN', reason },
    command: { argv, argvSha256: createHash('sha256').update(JSON.stringify(argv)).digest('hex') },
    environment: { names: Object.keys(process.env).sort(), secretValuesRecorded: false },
    directories: dirs,
    permissions: { requested: args.caseName === 'allow' ? 'allow sentinel operation' : 'deny bait/out-of-root operation', observed: 'UNKNOWN', reason },
    tools: { visible: [], callable: [], allowed: [], denied: [], status: 'UNKNOWN', reason },
    process: { before: [], during: [], after: [], quiescent: 'NOT_RUN', reason: 'No process was acquired.' },
    filesystem: { before: [], after: [], allowedTarget: join(dirs.work, 'allowed', 'sentinel'), baitTarget: join(dirs.bait, 'global-secret.txt'), status: 'NOT_RUN', reason },
    session: { value: {}, status: 'UNKNOWN', reason },
    handoff: { value: {}, status: 'UNKNOWN', reason },
    artifacts: { paths: [], sha256: [] },
    usage: { value: null, status: 'UNKNOWN', reason },
    native: { value: null, status: 'UNKNOWN', reason },
    blockedConditions, timestamps: { startedAt, finishedAt: new Date().toISOString() },
    cleanup: { rootRemoved: false, ownedResourcesOnly: true },
  }
}

/**
 * Record an honest BLOCKED result without starting any product or deleting evidence.
 * @param argv - explicit harness, case, execution plane, and optional absolute root.
 * @returns legacy v1 evidence; the caller owns retention and later cleanup.
 */
export function runValidation(argv: readonly string[]): HarnessEvidence {
  const args = parseArguments(argv)
  mkdirSync(args.root, { recursive: true })
  const runRoot = mkdtempSync(join(args.root, `${args.harness}-${args.caseName}-`))
  const evidence = blockedEvidence(args, runRoot, new Date().toISOString())
  const content = JSON.stringify(evidence, null, 2) + '\n'
  writeFileSync(join(runRoot, 'result.json'), content, { flag: 'wx' })
  writeFileSync(join(runRoot, 'manifest.json'), content, { flag: 'wx' })
  return evidence
}

/**
 * Map a product verdict to a CLI result, not to infrastructure-test success.
 * @param status - recorded verdict.
 * @returns process exit code; BLOCKED is deliberately nonzero.
 */
export function exitCodeForStatus(status: RunStatus): number {
  switch (status) {
    case 'PASS': return 0
    case 'FAIL': return 1
    case 'BLOCKED': return 2
    case 'NOT_RUN': return 3
  }
}

function main(): void {
  const evidence = runValidation(process.argv.slice(2))
  process.stdout.write(JSON.stringify(evidence, null, 2) + '\n')
  process.exitCode = exitCodeForStatus(evidence.status)
}

// Compatible with supported engines that predate import.meta.main.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
