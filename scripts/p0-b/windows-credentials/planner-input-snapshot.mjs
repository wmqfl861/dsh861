/** Prepare an exact committed read set, not a checkout or an OS sandbox. */
import { constants as bufferConstants } from 'node:buffer'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises'
import { devNull } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { projectCodexLaunch } from './codex-launch-projection.mjs'

const SHA256 = /^[a-f0-9]{64}$/
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
// Git for Windows rejects Node's os.devNull ('\\.\nul') as a config path; its null device is NUL.
const gitNullConfig = process.platform === 'win32' ? 'NUL' : devNull
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const positive = value => Number.isSafeInteger(value) && value > 0
const contains = (parent, child) => {
  const suffix = relative(parent, child)
  return suffix === '' || (suffix !== '..' && !suffix.startsWith('..' + sep) && !isAbsolute(suffix))
}

/** Fixed errors never attach Git output, file contents or credentials. */
export class PlannerSnapshotError extends Error {
  /** @param {string} code - stable refusal identifier. */
  constructor(code) { super(code); this.name = 'PlannerSnapshotError'; this.code = code }
}
const refuse = code => { throw new PlannerSnapshotError(code) }

function validateFiles(files, policy) {
  if (!Array.isArray(files) || files.length === 0 || files.length > policy.maxFiles) refuse('SNAPSHOT_READ_SET_INVALID')
  const seen = new Set(), directories = new Set(), spellings = new Map()
  for (const file of files) {
    if (!exact(file, ['path', 'sha256']) || typeof file.path !== 'string' || !SHA256.test(file.sha256)
      || Buffer.byteLength(file.path, 'utf8') > 1024 || /[\\:\x00-\x1f\x7f<>"|?*]/.test(file.path)
      || file.path !== file.path.normalize('NFC')) refuse('SNAPSHOT_READ_SET_INVALID')
    const parts = file.path.split('/')
    if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
      || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)
      || /^(?:\.git|\.hg|\.svn)$/i.test(part))) refuse('SNAPSHOT_READ_SET_INVALID')
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join('/'), folded = name.toLowerCase()
      if (spellings.has(folded) && spellings.get(folded) !== name) refuse('SNAPSHOT_READ_SET_INVALID')
      spellings.set(folded, name)
    }
    const key = file.path.toLowerCase()
    if (seen.has(key)) refuse('SNAPSHOT_READ_SET_INVALID')
    seen.add(key)
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/').toLowerCase())
  }
  if ([...directories].some(name => seen.has(name))) refuse('SNAPSHOT_READ_SET_INVALID')
}

async function plainDirectory(path) {
  if (!isAbsolute(path) || /^[\\/]{2}/.test(path)) refuse('SNAPSHOT_LOCATION_INVALID')
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('SNAPSHOT_LOCATION_INVALID')
  return realpath(path)
}

function gitReader(repository, policy, environment) {
  return (args, maxBuffer = 8192) => new Promise((resolveResult, reject) => {
    // Raw object reads do not invoke checkout filters. Missing objects must not trigger fetch.
    execFile(policy.gitExecutable, ['--no-replace-objects', '--no-lazy-fetch', '--no-optional-locks',
      '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-C', repository, ...args],
    { env: environment, encoding: null, windowsHide: true, shell: false,
      timeout: policy.gitTimeoutMs, killSignal: 'SIGKILL', maxBuffer }, (error, stdout) => {
      if (error) reject(new PlannerSnapshotError('SNAPSHOT_GIT_READ_FAILED'))
      else resolveResult(stdout)
    }).stdin?.end()
  })
}

async function removeOwnedTree(path) {
  const stat = await lstat(path)
  if (stat.isSymbolicLink()) { await unlink(path); return }
  if (!stat.isDirectory()) { await chmod(path, 0o600); await unlink(path); return }
  await chmod(path, 0o700)
  for (const name of await readdir(path)) await removeOwnedTree(join(path, name))
  await rmdir(path)
}

/**
 * Export only admitted Git blobs and prepare the existing planner input before signing it.
 * Git and both parent directories must be trusted and protected against concurrent replacement.
 * Modes are advisory; callers still need OS read isolation and an immutable deployment.
 * @param {import('./owner-approved-planner.ts').PreparedPlannerRun} input - unsigned fixed commit and read set.
 * @param {import('./planner-input-snapshot.mjs').PlannerSnapshotPolicy} policy - explicit local preparation limits.
 * @returns {Promise<import('./planner-input-snapshot.mjs').PreparedPlannerSnapshot>} owned snapshot and rebound unsigned input.
 */
export async function preparePlannerInputSnapshot(input, policy) {
  input = structuredClone(input)
  policy = structuredClone(policy)
  const policyKeys = ['gitExecutable', 'gitSha256', 'snapshotParent', 'gitTimeoutMs', 'maxFiles', 'maxFileBytes', 'maxTotalBytes']
  if (!exact(policy, policyKeys) || !isAbsolute(policy.gitExecutable) || !SHA256.test(policy.gitSha256)
    || ![policy.gitTimeoutMs, policy.maxFiles, policy.maxFileBytes, policy.maxTotalBytes].every(positive)
    || policy.gitTimeoutMs > 2147483647 || policy.maxFileBytes >= bufferConstants.MAX_LENGTH
    || policy.maxTotalBytes >= bufferConstants.MAX_LENGTH) refuse('SNAPSHOT_POLICY_INVALID')
  if (!/^[a-f0-9]{40}$/.test(input.sourceCommit) || input.run.input.platform !== process.platform) refuse('SNAPSHOT_REQUEST_INVALID')
  validateFiles(input.readSet, policy)
  // Preserve the actual route lock and native parameter generator; this creates no authorization.
  projectCodexLaunch(input.run.configuration, input.run.trustedLock, input.run.input)
  let allocation, identity, disposing, disposed = false
  try {
    const repository = await plainDirectory(input.run.input.workspace)
    const parent = await plainDirectory(policy.snapshotParent)
    const runRoot = resolve(input.run.input.runRoot)
    if (contains(repository, parent) || contains(parent, repository)
      || contains(runRoot, parent) || contains(parent, runRoot)) refuse('SNAPSHOT_LOCATION_INVALID')
    if (hash(await readFile(policy.gitExecutable)) !== policy.gitSha256) refuse('SNAPSHOT_GIT_IDENTITY_INVALID')
    const environment = { HOME: parent, USERPROFILE: parent, TEMP: parent, TMP: parent,
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: gitNullConfig, GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_COUNT: '0', GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1' }
    if (process.platform === 'win32') environment.SystemRoot = input.run.input.systemRoot
    const git = gitReader(repository, policy, environment)
    const top = (await git(['rev-parse', '--show-toplevel'])).toString('utf8').trim()
    if (await realpath(top) !== repository || (await git(['cat-file', '-t', input.sourceCommit])).toString() !== 'commit\n') {
      refuse('SNAPSHOT_COMMIT_INVALID')
    }
    const material = []
    let total = 0
    for (const file of input.readSet) {
      const entry = (await git(['ls-tree', '-z', input.sourceCommit, '--', file.path])).toString('utf8')
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(entry)
      if (!match || match[3] !== file.path) refuse('SNAPSHOT_ENTRY_INVALID')
      const sizeText = (await git(['cat-file', '-s', match[2]])).toString('ascii')
      if (!/^(0|[1-9][0-9]*)\n$/.test(sizeText)) refuse('SNAPSHOT_ENTRY_INVALID')
      const size = Number(sizeText)
      if (!Number.isSafeInteger(size) || size > policy.maxFileBytes || size > policy.maxTotalBytes - total) {
        refuse('SNAPSHOT_SIZE_EXCEEDED')
      }
      const bytes = await git(['cat-file', 'blob', match[2]], policy.maxFileBytes + 1)
      if (bytes.length !== size || hash(bytes) !== file.sha256) refuse('SNAPSHOT_CONTENT_MISMATCH')
      total += size
      material.push({ file: { ...file, gitBlob: match[2], bytes: size }, bytes })
    }
    // Allocate only after every source blob was verified. No destination supplied by a request is overwritten.
    allocation = await mkdtemp(join(parent, 'dsh-planner-input-'))
    identity = await lstat(allocation)
    const workspace = join(allocation, 'input')
    await mkdir(workspace, { mode: 0o700 })
    for (const item of material) {
      const target = join(workspace, item.file.path)
      await mkdir(dirname(target), { recursive: true, mode: 0o700 })
      await writeFile(target, item.bytes, { flag: 'wx', mode: 0o400 })
    }
    const manifestText = JSON.stringify({ version: 1, sourceCommit: input.sourceCommit,
      files: material.map(item => item.file), totalBytes: total }) + '\n'
    await writeFile(join(allocation, 'manifest.json'), manifestText, { flag: 'wx', mode: 0o400 })
    const expectedFiles = new Map(material.map(item => [item.file.path, item.file]))
    const expectedDirectories = new Set()
    for (const file of expectedFiles.keys()) {
      const parts = file.split('/')
      for (let i = 1; i < parts.length; i++) expectedDirectories.add(parts.slice(0, i).join('/'))
    }
    const assertOwned = async () => {
      const current = await lstat(allocation)
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino) {
        refuse('SNAPSHOT_IDENTITY_CHANGED')
      }
    }
    const verify = async () => {
      try {
        if (disposed) refuse('SNAPSHOT_DISPOSED')
        await assertOwned()
        const rootEntries = (await readdir(allocation)).sort()
        if (rootEntries.join('\0') !== 'input\0manifest.json') refuse('SNAPSHOT_CONTENT_MISMATCH')
        const manifestStat = await lstat(join(allocation, 'manifest.json'))
        const inputStat = await lstat(workspace)
        if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || !inputStat.isDirectory() || inputStat.isSymbolicLink()
          || manifestStat.size !== Buffer.byteLength(manifestText)
          || await readFile(join(allocation, 'manifest.json'), 'utf8') !== manifestText) refuse('SNAPSHOT_CONTENT_MISMATCH')
        let count = 0
        const visit = async (directory, prefix) => {
          for (const name of await readdir(directory)) {
            const logical = prefix ? prefix + '/' + name : name
            const path = join(directory, name), stat = await lstat(path)
            if (stat.isSymbolicLink()) refuse('SNAPSHOT_CONTENT_MISMATCH')
            if (stat.isDirectory()) {
              if (!expectedDirectories.has(logical)) refuse('SNAPSHOT_CONTENT_MISMATCH')
              await visit(path, logical)
            } else {
              const expected = expectedFiles.get(logical)
              if (!stat.isFile() || !expected || stat.size !== expected.bytes) refuse('SNAPSHOT_CONTENT_MISMATCH')
              const handle = await open(path, 'r')
              try {
                const bytes = Buffer.alloc(expected.bytes + 1)
                let length = 0
                while (length < bytes.length) {
                  const read = await handle.read(bytes, length, bytes.length - length, null)
                  if (read.bytesRead === 0) break
                  length += read.bytesRead
                }
                if (length !== expected.bytes || hash(bytes.subarray(0, length)) !== expected.sha256) refuse('SNAPSHOT_CONTENT_MISMATCH')
              } finally { await handle.close() }
              count++
            }
          }
        }
        await visit(workspace, '')
        if (count !== expectedFiles.size) refuse('SNAPSHOT_CONTENT_MISMATCH')
      } catch (error) {
        if (error instanceof PlannerSnapshotError) throw error
        refuse('SNAPSHOT_CONTENT_MISMATCH')
      }
    }
    const dispose = () => {
      if (disposed) return Promise.resolve()
      if (!disposing) {
        disposing = (async () => {
          try { await assertOwned(); await removeOwnedTree(allocation); disposed = true }
          catch { refuse('SNAPSHOT_CLEANUP_BLOCKED') }
        })().finally(() => { disposing = undefined })
      }
      return disposing
    }
    const prepared = structuredClone(input)
    prepared.run.input.workspace = workspace
    prepared.run.input.workspaceKind = 'fixed-input-snapshot'
    const projection = projectCodexLaunch(prepared.run.configuration, prepared.run.trustedLock, prepared.run.input)
    await verify()
    return Object.freeze({ status: 'PLANNER_INPUT_PREPARED_NOT_AUTHORIZED', prepared, projection,
      directory: allocation, workspace, manifestSha256: hash(manifestText), totalBytes: total,
      verify, dispose, executionAuthorized: false, productAccepted: false })
  } catch (error) {
    if (allocation && identity) {
      try {
        const current = await lstat(allocation)
        if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino) {
          refuse('SNAPSHOT_CLEANUP_BLOCKED')
        }
        await removeOwnedTree(allocation)
      } catch { refuse('SNAPSHOT_CLEANUP_BLOCKED') }
    }
    if (error instanceof PlannerSnapshotError) throw error
    refuse('SNAPSHOT_PREPARATION_FAILED')
  }
}
