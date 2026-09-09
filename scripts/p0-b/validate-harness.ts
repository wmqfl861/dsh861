import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'

const DEFAULT_ROOT = 'D:/Temp_projects/dsh861-p0-b-harness-validation'
const HARNESS_NAMES = ['codex', 'claude-code', 'opencode', 'grok'] as const
const CASE_NAMES = ['allow', 'deny'] as const

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

/** Serializable evidence record emitted by a B2 validation run. */
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
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === undefined) continue
    if (!argument.startsWith('--')) fail(`unexpected argument ${JSON.stringify(argument)}`)
    const equal = argument.indexOf('=')
    if (equal !== -1) {
      values.set(argument.slice(2, equal), argument.slice(equal + 1))
      continue
    }
    const name = argument.slice(2)
    if (name === 'source' || name === 'artifact' || name === 'expect-denied' || name === 'require-real-product') {
      if (name === 'source' || name === 'artifact') {
        if (flags.has(name)) fail(`duplicate --${name}`)
        flags.add(name)
      }
      if (name === 'expect-denied' || name === 'require-real-product') flags.add(name)
      continue
    }
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`missing value for --${name}`)
    values.set(name, value)
    index += 1
  }
  const harness = oneOf(values.get('harness'), HARNESS_NAMES, '--harness')
  const caseName = oneOf(values.get('case'), CASE_NAMES, '--case')
  if (flags.has('source') && flags.has('artifact')) fail('--source and --artifact are mutually exclusive')
  if (!flags.has('source') && !flags.has('artifact')) fail('one of --source or --artifact is required')
  const mode: RunMode = flags.has('source') ? 'source' : 'artifact'
  const root = values.get('root') ?? DEFAULT_ROOT
  if (!isAbsolute(root)) fail('--root must be an absolute path')
  return { harness, caseName, mode, expectDenied: flags.has('expect-denied'), requireRealProduct: flags.has('require-real-product'), root: resolve(root) }
}

function hashArgv(argv: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(argv)).digest('hex')
}

function scrubbedNames(): string[] {
  return Object.keys(process.env).sort()
}

function directories(runRoot: string): DirectoryRecord {
  const result: DirectoryRecord = {
    root: runRoot,
    config: join(runRoot, 'config'),
    authReference: join(runRoot, 'auth-reference'),
    home: join(runRoot, 'home'),
    cache: join(runRoot, 'cache'),
    session: join(runRoot, 'session'),
    logs: join(runRoot, 'logs'),
    work: join(runRoot, 'work'),
    bait: join(runRoot, 'bait'),
    artifacts: join(runRoot, 'artifacts'),
    process: join(runRoot, 'process'),
    raw: join(runRoot, 'raw'),
  }
  for (const path of Object.values(result)) mkdirSync(path, { recursive: true })
  return result
}

function blockedEvidence(args: Arguments, runRoot: string, startedAt: string): HarnessEvidence {
  const dirs = directories(runRoot)
  const argv = ['<real-adapter-unregistered>', args.harness, args.caseName, args.mode]
  const blockedConditions = [
    `No registered real ${args.harness} adapter is available in B2.`,
    'No product process was started; no allow or deny operation was observed.',
    'A real product credential, protocol and external observation are required before PASS.',
  ]
  if (args.requireRealProduct) blockedConditions.push('--require-real-product cannot be satisfied by the adapterless B2 foundation.')
  const finishedAt = new Date().toISOString()
  return {
    node: 'P0-B',
    planVersion: 'v1',
    harness: args.harness,
    case: args.caseName,
    mode: args.mode,
    status: 'BLOCKED',
    runId: basename(runRoot),
    requireRealProduct: args.requireRealProduct,
    expectDenied: args.expectDenied,
    program: { value: { argv }, status: 'UNKNOWN', reason: 'No real product adapter is registered.' },
    version: { value: 'UNKNOWN', status: 'UNKNOWN', reason: 'No real product process was started.' },
    command: { argv, argvSha256: hashArgv(argv) },
    environment: { names: scrubbedNames(), secretValuesRecorded: false },
    directories: dirs,
    permissions: { requested: args.caseName === 'allow' ? 'allow sentinel operation' : 'deny bait/out-of-root operation', observed: 'UNKNOWN', reason: 'No real product process was started.' },
    tools: { visible: [], callable: [], allowed: [], denied: [], status: 'UNKNOWN', reason: 'Native and DSH tool sets are not available without a product adapter.' },
    process: { before: [], during: [], after: [], quiescent: 'NOT_RUN', reason: 'No process was acquired.' },
    filesystem: { before: [], after: [], allowedTarget: join(dirs.work, 'allowed', 'sentinel'), baitTarget: join(dirs.bait, 'global-secret.txt'), status: 'NOT_RUN', reason: 'No product operation was executed.' },
    session: { value: {}, status: 'UNKNOWN', reason: 'No product Session was created.' },
    handoff: { value: {}, status: 'UNKNOWN', reason: 'No product handoff was created.' },
    artifacts: { paths: [], sha256: [] },
    usage: { value: null, status: 'UNKNOWN', reason: 'No provider response was received.' },
    native: { value: null, status: 'UNKNOWN', reason: 'No native protocol or tool observation was available.' },
    blockedConditions,
    timestamps: { startedAt, finishedAt },
    cleanup: { rootRemoved: false, ownedResourcesOnly: true },
  }
}

/** Run the adapterless B2 foundation and record an honest blocked result. */
export function runValidation(argv: readonly string[]): HarnessEvidence {
  const args = parseArguments(argv)
  mkdirSync(args.root, { recursive: true })
  const runRoot = mkdtempSync(join(args.root, `${args.harness}-${args.caseName}-`))
  const startedAt = new Date().toISOString()
  const evidence = blockedEvidence(args, runRoot, startedAt)
  const resultPath = join(runRoot, 'result.json')
  writeFileSync(resultPath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' })
  writeFileSync(join(runRoot, 'manifest.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' })
  return evidence
}

function main(): void {
  const evidence = runValidation(process.argv.slice(2))
  process.stdout.write(JSON.stringify(evidence, null, 2) + '\n')
  rmSync(evidence.directories.root, { recursive: true, force: true })
}

if (import.meta.main) main()
