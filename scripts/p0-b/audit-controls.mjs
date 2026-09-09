/** Dependency-free, offline audit controls. These do not certify real harness support. */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const empty = value => Array.isArray(value) && value.length === 0

/**
 * Apply semantic constraints to legacy adapterless B2 evidence.
 * This is deliberately NOT a general JSON Schema validator or a v2 product runner.
 * @param {unknown} value - parsed legacy evidence.
 * @returns {string[]} violations; an empty array means a consistent BLOCKED record only.
 */
export function foundationErrors(value) {
  if (!object(value)) return ['Evidence must be an object.']
  const e = value
  const errors = []
  const require = (condition, message) => { if (!condition) errors.push(message) }
  require(e.node === 'P0-B' && e.planVersion === 'v1', 'Unsupported legacy foundation version.')
  require(['codex', 'claude-code', 'opencode', 'grok'].includes(e.harness), 'Unknown harness.')
  require(['allow', 'deny'].includes(e.case), 'Unknown foundation case.')
  require(['source', 'artifact'].includes(e.mode), 'Unknown execution plane.')
  require(e.status === 'BLOCKED', 'Adapterless foundation can never certify PASS.')
  require(nonempty(e.runId), 'Missing run id.')
  require(Array.isArray(e.blockedConditions) && e.blockedConditions.length > 0
    && e.blockedConditions.every(nonempty), 'BLOCKED requires explicit reasons.')
  for (const field of ['program', 'version', 'session', 'handoff', 'usage', 'native']) {
    require(object(e[field]) && e[field].status === 'UNKNOWN' && nonempty(e[field].reason),
      `${field} must remain UNKNOWN with a reason.`)
  }
  require(e.program?.value?.absolutePath === undefined, 'Foundation must not claim a real executable.')
  require(e.permissions?.observed === 'UNKNOWN', 'Foundation has no permission observation.')
  require(e.tools?.status === 'UNKNOWN', 'Foundation has no tool observation.')
  for (const field of ['visible', 'callable', 'allowed', 'denied']) {
    require(empty(e.tools?.[field]), `Foundation tools.${field} must be empty.`)
  }
  require(e.process?.quiescent === 'NOT_RUN', 'Foundation has no process-quiescence evidence.')
  for (const field of ['before', 'during', 'after']) {
    require(empty(e.process?.[field]), `Foundation process.${field} must be empty.`)
  }
  require(e.filesystem?.status === 'NOT_RUN'
    && empty(e.filesystem?.before) && empty(e.filesystem?.after), 'Foundation has no filesystem observation.')
  require(empty(e.artifacts?.paths) && empty(e.artifacts?.sha256), 'Foundation has no product artifacts.')
  require(e.usage?.value === null && e.native?.value === null, 'Foundation has no native usage or events.')
  require(e.environment?.secretValuesRecorded === false, 'Secret recording is forbidden.')
  require(e.cleanup?.rootRemoved === false && e.cleanup?.ownedResourcesOnly === true,
    'Foundation evidence must be retained; cleanup is a separate operation.')
  return errors
}

/** Check AC titles against the actual specification, not a duplicate title list. */
export function acceptanceMapErrors(mapping, specification) {
  if (!object(mapping) || !object(mapping.definitions) || !Array.isArray(mapping.cases)) {
    return ['Invalid acceptance map.']
  }
  const titles = new Map()
  for (const line of specification.split('\n')) {
    const match = line.match(/^\|\s*(AC-\d{2})\s*\|\s*([^|]+)\|/)
    if (match) titles.set(match[1], match[2].trim())
  }
  const errors = []
  const version = specification.match(/版本：\s*([0-9.]+)/)?.[1]?.replace(/\.$/, '')
  if (version !== mapping.requirementsVersion) errors.push('Requirement version mismatch.')
  if (titles.size !== 32) errors.push('Expected all 32 product AC definitions; partial input is not authoritative.')
  if (Object.keys(mapping.definitions).length === 0 || mapping.cases.length === 0) errors.push('Empty acceptance map.')
  for (const [id, title] of Object.entries(mapping.definitions)) {
    if (titles.get(id) !== title) errors.push(`Incorrect or unknown AC definition: ${id}`)
  }
  const seen = new Set()
  for (const item of mapping.cases) {
    if (!object(item) || !/^P0B-[A-Z-]+-\d{2}$/.test(item.caseId) || seen.has(item.caseId)) {
      errors.push('Invalid or duplicate node-local case id.')
      continue
    }
    seen.add(item.caseId)
    if (!Array.isArray(item.productAc) || item.productAc.length === 0
      || item.productAc.some(id => !Object.hasOwn(mapping.definitions, id))) errors.push('Case has undefined AC references.')
    if (!['PARTIAL', 'OUT_OF_SCOPE'].includes(item.coverage)) errors.push('P0-B mapping must not imply full product acceptance.')
  }
  return errors
}

function safePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.includes('\\')
    && !path.includes('\0') && !path.includes(':') && !path.startsWith('/')
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
}

/**
 * Recompute exact file bytes. Git mode binds reads to an immutable commit, not checkout EOLs.
 * A normalization hint is diagnostic only and NEVER converts a mismatch to PASS.
 * @param {{files: Array<{path: string, type: string, bytes: number, sha256: string}>}} manifest
 * @param {{root: string, commit?: string}} options
 * @returns {{passed: boolean, mode: string, files: object[]}}
 */
export function verifyCandidate(manifest, { root, commit }) {
  if (!object(manifest) || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Candidate must contain a nonempty files inventory.')
  }
  if (commit !== undefined && !/^[0-9a-f]{40}$/.test(commit)) throw new Error('An exact commit SHA is required.')
  const canonicalRoot = realpathSync(root)
  const seen = new Set()
  const files = manifest.files.map(entry => {
    if (!object(entry) || !safePath(entry.path) || seen.has(entry.path) || entry.type !== 'file'
      || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new Error('Invalid, duplicate, or unsupported candidate entry; no entries may be silently skipped.')
    }
    seen.add(entry.path)
    let bytes
    try {
      if (commit !== undefined) {
        const tree = execFileSync('git', ['-C', canonicalRoot, 'ls-tree', '-z', commit, '--', entry.path],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        if (!/^100(644|755) blob [0-9a-f]{40}\t/.test(tree)) throw new Error('Not a regular Git blob.')
        bytes = execFileSync('git', ['-C', canonicalRoot, 'show', `${commit}:${entry.path}`],
          { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
      } else {
        const file = realpathSync(resolve(canonicalRoot, entry.path))
        const rel = relative(canonicalRoot, file)
        if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Path escapes root.')
        bytes = readFileSync(file)
      }
    } catch {
      return { path: entry.path, status: 'UNREADABLE_OR_UNSAFE' }
    }
    const actualSha256 = digest(bytes)
    const matches = bytes.length === entry.bytes && actualSha256 === entry.sha256
    const result = { path: entry.path, status: matches ? 'PASS' : 'MISMATCH',
      expectedBytes: entry.bytes, actualBytes: bytes.length, expectedSha256: entry.sha256, actualSha256 }
    const text = bytes.toString('utf8')
    if (!matches && Buffer.from(text).equals(bytes)) {
      const lf = text.replace(/\r\n/g, '\n')
      if ([Buffer.from(lf), Buffer.from(lf.replace(/\n/g, '\r\n'))]
        .some(alternate => alternate.length === entry.bytes && digest(alternate) === entry.sha256)) {
        result.normalizationHint = 'LF_CRLF_ONLY_NOT_ACCEPTED'
      }
    }
    return result
  })
  return { passed: files.every(file => file.status === 'PASS'), mode: commit === undefined ? 'retained-bytes' : 'git-blob', files }
}

function parse(argv) {
  const action = argv[0]
  if (!['foundation', 'candidate', 'mapping'].includes(action)) throw new Error('Choose foundation, candidate, or mapping.')
  const admitted = action === 'foundation' ? ['evidence'] : action === 'mapping' ? ['map', 'spec'] : ['manifest', 'root', 'commit']
  const values = {}
  for (let i = 1; i < argv.length; i += 2) {
    const name = argv[i]?.slice(2)
    const value = argv[i + 1]
    if (!argv[i]?.startsWith('--') || !admitted.includes(name) || Object.hasOwn(values, name)
      || !value || value.startsWith('--')) throw new Error('Unknown, duplicate, or incomplete audit option.')
    values[name] = value
  }
  if (action === 'foundation' && !values.evidence) throw new Error('--evidence is required.')
  if (action === 'mapping' && (!values.map || !values.spec)) throw new Error('--map and --spec are required.')
  if (action === 'candidate' && (!values.manifest || !values.root)) throw new Error('--manifest and --root are required.')
  return { action, values }
}

function main() {
  try {
    const { action, values } = parse(process.argv.slice(2))
    if (action === 'foundation') {
      const errors = foundationErrors(JSON.parse(readFileSync(values.evidence, 'utf8')))
      console.log(JSON.stringify({ validFoundation: errors.length === 0, productAccepted: false, errors }, null, 2))
      // 2 = consistent BLOCKED, not product success; 1 = invalid evidence.
      process.exitCode = errors.length === 0 ? 2 : 1
    } else if (action === 'mapping') {
      const errors = acceptanceMapErrors(JSON.parse(readFileSync(values.map, 'utf8')), readFileSync(values.spec, 'utf8'))
      console.log(JSON.stringify({ validMapping: errors.length === 0, errors }, null, 2))
      process.exitCode = errors.length === 0 ? 0 : 1
    } else {
      const report = verifyCandidate(JSON.parse(readFileSync(values.manifest, 'utf8')), values)
      console.log(JSON.stringify(report, null, 2))
      process.exitCode = report.passed ? 0 : 1
    }
  } catch {
    // Do not echo arbitrary evidence or argument values into a diagnostic log.
    console.error('Audit control failed: invalid input, unreadable file, or unsupported evidence.')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
