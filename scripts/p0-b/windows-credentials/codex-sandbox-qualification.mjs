/** Offline qualification data and observations; this module never starts Codex or grants production access. */
import { createHash, randomBytes } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const profile = 'dsh-scope-probe'
const probeSource = fileURLToPath(new URL('./fixtures/sandbox-file-probe.mjs', import.meta.url))
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const contains = (parent, child) => {
  const part = relative(parent, child)
  return part === '' || (part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part))
}

/** Fixed errors do not expose source content or operating-system diagnostics. */
export class SandboxQualificationError extends Error {
  /** @param {string} code - stable qualification failure code. */
  constructor(code) { super(code); this.name = 'SandboxQualificationError'; this.code = code }
}
const fail = code => { throw new SandboxQualificationError(code) }
const absolute = value => typeof value === 'string' && isAbsolute(value) && !/[\0\r\n]/.test(value)
  && !/^[\\/]{2}/.test(value)
const denied = value => exact(value, ['outcome', 'code']) && value.outcome === 'error' && ['EACCES', 'EPERM'].includes(value.code)
const allowed = (value, expected) => exact(value, ['outcome', 'sha256']) && value.outcome === 'allowed' && value.sha256 === expected

/**
 * Allocate only synthetic, normally readable/writable files under an existing trusted local parent.
 * No accounts, ACLs, firewall rules, system trust, credentials or production configurations are touched.
 * Caller protects the parent and owns any native process before disposal; the recipe is not a sandbox.
 * @param {{parent:string, nodeExecutable:string, nodeSha256:string, systemRoot:string|null}} input - local fixture paths and binary pin.
 * @returns {Promise<object>} owned probe files, explicit diagnostic commands and observation checks.
 */
export async function prepareCodexSandboxQualification(input) {
  if (!exact(input, ['parent', 'nodeExecutable', 'nodeSha256', 'systemRoot'])
    || !absolute(input.parent) || !absolute(input.nodeExecutable) || !/^[a-f0-9]{64}$/.test(input.nodeSha256)
    || (process.platform === 'win32' ? !absolute(input.systemRoot) : input.systemRoot !== null)) fail('SANDBOX_PROBE_SPEC_INVALID')
  const spec = { ...input }
  const parentStat = await lstat(spec.parent)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) fail('SANDBOX_PROBE_PARENT_INVALID')
  const parent = await realpath(spec.parent), node = await realpath(spec.nodeExecutable)
  if (contains(parent, node) || contains(dirname(node), parent) || hash(await readFile(node)) !== spec.nodeSha256) {
    fail('SANDBOX_PROBE_BINARY_INVALID')
  }
  const source = await readFile(probeSource)
  const directory = await mkdtemp(join(parent, 'dsh-native-scope-'))
  const identity = await lstat(directory)
  let disposed = false
  let baselineVerified = false
  let configToml
  const dirs = Object.fromEntries(['workspace', 'private', 'tools', 'home', 'codex-home', 'tmp'].map(name => [name, join(directory, name)]))
  const nonce = randomBytes(24).toString('hex')
  const allowedBytes = Buffer.from('ALLOWED-' + randomBytes(24).toString('hex'))
  const outsideBytes = Buffer.from('OUTSIDE-' + randomBytes(24).toString('hex'))
  const files = { allowed: join(dirs.workspace, 'input.txt'), outside: join(dirs.private, 'outside.txt'),
    probe: join(dirs.tools, 'probe.mjs'), insideWrite: join(dirs.workspace, 'attempt.txt'), outsideWrite: join(dirs.private, 'attempt.txt') }
  const assertOwned = async () => {
    const current = await lstat(directory)
    if (disposed || !current.isDirectory() || current.isSymbolicLink() || current.ino !== identity.ino || current.dev !== identity.dev) {
      fail('SANDBOX_PROBE_IDENTITY_CHANGED')
    }
  }
  const present = async path => {
    try { await lstat(path); return true }
    catch (error) { if (error.code === 'ENOENT') return false; throw error }
  }
  const checkFiles = async writes => {
    await assertOwned()
    for (const [file, bytes] of [[files.allowed, allowedBytes], [files.outside, outsideBytes], [files.probe, source]]) {
      const stat = await lstat(file)
      if (!stat.isFile() || stat.isSymbolicLink() || hash(await readFile(file)) !== hash(bytes)) fail('SANDBOX_PROBE_FIXTURE_CHANGED')
    }
    const configPath = join(dirs['codex-home'], 'config.toml')
    const configStat = await lstat(configPath)
    if (!configStat.isFile() || configStat.isSymbolicLink() || await readFile(configPath, 'utf8') !== configToml) {
      fail('SANDBOX_PROBE_FIXTURE_CHANGED')
    }
    for (const file of [files.insideWrite, files.outsideWrite]) {
      if (await present(file) !== writes) fail('SANDBOX_PROBE_SIDE_EFFECT_MISMATCH')
      if (writes) {
        const stat = await lstat(file)
        if (!stat.isFile() || stat.isSymbolicLink() || await readFile(file, 'utf8') !== 'SYNTHETIC-WRITE\n') {
          fail('SANDBOX_PROBE_SIDE_EFFECT_MISMATCH')
        }
      }
    }
  }
  let cleaning
  const remove = async path => {
    const stat = await lstat(path)
    if (stat.isSymbolicLink() || !stat.isDirectory()) { await unlink(path); return }
    for (const name of await readdir(path)) await remove(join(path, name))
    await rmdir(path)
  }
  const dispose = () => {
    if (disposed) return Promise.resolve()
    if (!cleaning) cleaning = (async () => {
      await assertOwned(); await remove(directory); disposed = true
    })()
    return cleaning
  }
  try {
    for (const path of Object.values(dirs)) await mkdir(path, { mode: 0o700 })
    await writeFile(files.allowed, allowedBytes, { flag: 'wx', mode: 0o600 })
    await writeFile(files.outside, outsideBytes, { flag: 'wx', mode: 0o600 })
    await writeFile(files.probe, source, { flag: 'wx', mode: 0o600 })
    const env = { HOME: dirs.home, USERPROFILE: dirs.home, TEMP: dirs.tmp, TMP: dirs.tmp, TMPDIR: dirs.tmp,
      PATH: process.platform === 'win32' ? [dirname(node), join(spec.systemRoot, 'System32')].join(';') : dirname(node) }
    if (process.platform === 'win32') Object.assign(env, { SystemRoot: spec.systemRoot, WINDIR: spec.systemRoot })
    const mainEnv = Object.freeze({ ...env, CODEX_HOME: dirs['codex-home'] })
    const quote = value => JSON.stringify(value)
    configToml = [
      'approval_policy = "never"', 'web_search = "disabled"', '', '[windows]', 'sandbox = "unelevated"', '',
      `[permissions.${profile}.filesystem]`, '":root" = "deny"', '":minimal" = "read"',
      `${quote(dirs.workspace)} = "read"`, `${quote(files.probe)} = "read"`, `${quote(dirname(node))} = "read"`,
      `${quote(dirs.private)} = "deny"`, '', `[permissions.${profile}.network]`, 'enabled = false', '',
      '[shell_environment_policy]', 'inherit = "none"', 'ignore_default_excludes = false',
      'exclude = ["*KEY*", "*TOKEN*", "*SECRET*"]', `set = { ${Object.entries(env).map(([k, v]) => `${quote(k)} = ${quote(v)}`).join(', ')} }`, '',
    ].join('\n')
    const configFile = join(dirs['codex-home'], 'config.toml')
    await writeFile(configFile, configToml, { flag: 'wx', mode: 0o600 })
    const command = Object.freeze([node, files.probe, 'probe', nonce, files.allowed, files.outside, files.insideWrite, files.outsideWrite])
    const sandboxArgs = Object.freeze(['sandbox', '--permission-profile', profile, '--include-managed-config',
      '--cd', dirs.workspace, '--', ...command])
    const parse = result => {
      if (result.error || result.signal || result.timedOut || result.exitCode !== 0) fail('SANDBOX_PROBE_NOT_COMPLETED')
      let value
      try {
        if (typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > 16384) fail('SANDBOX_PROBE_PROTOCOL_INVALID')
        value = JSON.parse(result.stdout)
      } catch { fail('SANDBOX_PROBE_PROTOCOL_INVALID') }
      if (!exact(value, ['version', 'nonce', 'pid', 'cwd', 'allowedRead', 'outsideRead', 'insideWrite', 'outsideWrite', 'child'])
        || value.version !== 1 || value.nonce !== nonce || !Number.isSafeInteger(value.pid) || value.pid < 1
        || value.cwd !== dirs.workspace || !allowed(value.allowedRead, hash(allowedBytes))
        || !exact(value.child, ['exitCode', 'signal', 'started', 'receipt']) || value.child.exitCode !== 0
        || value.child.signal !== null || value.child.started !== true
        || !exact(value.child.receipt, ['version', 'nonce', 'pid', 'result']) || value.child.receipt.version !== 1
        || value.child.receipt.nonce !== nonce || !Number.isSafeInteger(value.child.receipt.pid) || value.child.receipt.pid < 1
        || value.child.receipt.pid === value.pid) {
        fail('SANDBOX_PROBE_PROTOCOL_INVALID')
      }
      return value
    }
    const verifyBaseline = async result => {
      const value = parse(result)
      if (!allowed(value.outsideRead, hash(outsideBytes)) || !allowed(value.child.receipt.result, hash(outsideBytes))
        || !allowed(value.insideWrite, hash('created')) || !allowed(value.outsideWrite, hash('created'))) {
        fail('SANDBOX_PROBE_BASELINE_NOT_ESTABLISHED')
      }
      await checkFiles(true)
      for (const file of [files.insideWrite, files.outsideWrite]) await unlink(file)
      await checkFiles(false)
      baselineVerified = true
    }
    const verifyRestricted = async result => {
      if (!baselineVerified) fail('SANDBOX_PROBE_BASELINE_REQUIRED')
      const value = parse(result)
      if (![value.outsideRead, value.insideWrite, value.outsideWrite, value.child.receipt.result].every(denied)) {
        fail('SANDBOX_SCOPE_NOT_ENFORCED')
      }
      await checkFiles(false)
      return Object.freeze({ status: 'SANDBOX_SCOPE_OBSERVED', scope: 'synthetic-command-and-descendant-only',
        configSha256: hash(configToml), probeSha256: hash(source), parentPid: value.pid, childPid: value.child.receipt.pid,
        allowedReadVerified: true, deniedReads: 2, deniedWrites: 2, externalFilesUnchanged: true,
        modelCalled: false, productionIsolationAccepted: false, productAccepted: false })
    }
    return Object.freeze({ directory, workspace: dirs.workspace, configFile, configToml, command, sandboxArgs,
      environment: mainEnv, verifyBaseline, verifyRestricted, dispose, productAccepted: false })
  } catch (error) {
    try { await dispose() } catch { fail('SANDBOX_PROBE_CLEANUP_BLOCKED') }
    throw error
  }
}
