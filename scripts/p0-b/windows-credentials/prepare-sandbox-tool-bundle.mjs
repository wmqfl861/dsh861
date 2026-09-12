/** Verify and copy local pinned sandbox tools; never download, execute or install them. */
import { createHash } from 'node:crypto'
import { lstat, mkdtemp, open, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const names = { codex: 'codex.exe', setup: 'codex-windows-sandbox-setup.exe', runner: 'codex-command-runner.exe' }
const currentVersion = '0.154.0'
const stableVersion = value => typeof value === 'string' && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value)
const sha256 = value => createHash('sha256').update(value).digest('hex')
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const absolute = value => typeof value === 'string' && isAbsolute(value) && !/[\0\r\n]/.test(value)
  && !/^[\\/]{2}/.test(value)
const identityMatches = (a, b) => a.dev === b.dev && a.ino === b.ino

/** Fixed refusal messages contain no file contents, credentials or operating-system cause. */
export class SandboxBundleError extends Error {
  /** @param {string} code - stable preparation refusal code. */
  constructor(code) { super(code); this.name = 'SandboxBundleError'; this.code = code }
}
const refuse = code => { throw new SandboxBundleError(code) }

async function verifiedCopy(source, pin, destination) {
  const before = await lstat(source)
  if (!before.isFile() || before.isSymbolicLink() || before.size !== pin.bytes) refuse('BUNDLE_SOURCE_INVALID')
  const input = await open(source, 'r')
  let output
  try {
    const opened = await input.stat()
    if (!identityMatches(before, opened) || opened.size !== pin.bytes) refuse('BUNDLE_SOURCE_CHANGED')
    if (destination) output = await open(destination, 'wx', 0o600)
    const digest = createHash('sha256'), buffer = Buffer.alloc(65536)
    let total = 0
    while (true) {
      const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, pin.bytes - total + 1), null)
      if (bytesRead === 0) break
      total += bytesRead
      if (total > pin.bytes) refuse('BUNDLE_SOURCE_CHANGED')
      digest.update(buffer.subarray(0, bytesRead))
      if (output) {
        let offset = 0
        while (offset < bytesRead) {
          const { bytesWritten } = await output.write(buffer, offset, bytesRead - offset, null)
          if (bytesWritten === 0) refuse('BUNDLE_WRITE_FAILED')
          offset += bytesWritten
        }
      }
    }
    const after = await input.stat(), current = await lstat(source)
    if (total !== pin.bytes || !identityMatches(opened, after) || !identityMatches(after, current)
      || current.isSymbolicLink() || after.size !== pin.bytes || current.size !== pin.bytes
      || opened.mtimeMs !== after.mtimeMs || after.mtimeMs !== current.mtimeMs) refuse('BUNDLE_SOURCE_CHANGED')
    if (digest.digest('hex') !== pin.sha256) refuse('BUNDLE_DIGEST_MISMATCH')
    if (output) await output.sync()
  } finally {
    try { if (output) await output.close() } finally { await input.close() }
  }
}

/**
 * Prepare an owned local bundle using an independently reviewed manifest, not a submitted approval.
 * Sources and staging parents must be protected from hostile concurrent replacement by the caller.
 * Hash checks establish bytes at inspection, not OS isolation, publisher signature or safe execution.
 * @param {{parent:string,sources:{codex:string,setup:string,runner:string}}} specification - explicit local source files and existing staging parent.
 * @param {object} trustedManifest - reviewed release pins; the CLI loads only an adjacent checked-in version manifest.
 * @returns {Promise<object>} verified inactive directory, verification function and exact owned cleanup.
 */
export async function prepareSandboxToolBundle(specification, trustedManifest) {
  const spec = structuredClone(specification), manifest = structuredClone(trustedManifest)
  if (!exact(spec, ['parent', 'sources']) || !absolute(spec.parent)
    || !exact(spec.sources, Object.keys(names)) || !Object.values(spec.sources).every(absolute)
    || manifest?.version !== 1 || manifest.product !== 'codex-windows-sandbox-tools'
    || !stableVersion(manifest.codexVersion) || manifest.target !== 'x86_64-pc-windows-msvc'
    || !Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 3) refuse('BUNDLE_SPEC_INVALID')
  const pins = Object.keys(names).map(role => {
    const matches = manifest.artifacts.filter(pin => pin?.role === role)
    const pin = matches[0]
    if (matches.length !== 1 || pin.fileName !== names[role] || !Number.isSafeInteger(pin.bytes)
      || pin.bytes < 1 || pin.bytes > 512 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(pin.sha256)) refuse('BUNDLE_MANIFEST_INVALID')
    return Object.freeze({ role, fileName: pin.fileName, bytes: pin.bytes, sha256: pin.sha256 })
  })
  Object.freeze(pins)
  let directory, identity, cleanup, disposed = false
  const expectedNames = [...Object.values(names), 'bundle-manifest.json'].sort()
  const assertOwned = async () => {
    const stat = await lstat(directory)
    if (disposed || !stat.isDirectory() || stat.isSymbolicLink() || !identityMatches(identity, stat)) refuse('BUNDLE_IDENTITY_CHANGED')
  }
  const dispose = () => {
    if (disposed) return Promise.resolve()
    if (!cleanup) cleanup = (async () => {
      try {
        await assertOwned()
        const present = await readdir(directory)
        if (present.some(name => !expectedNames.includes(name))) refuse('BUNDLE_CLEANUP_BLOCKED')
        for (const name of present) {
          const path = join(directory, name), stat = await lstat(path)
          if (!stat.isFile() && !stat.isSymbolicLink()) refuse('BUNDLE_CLEANUP_BLOCKED')
          await unlink(path)
        }
        await rmdir(directory)
        disposed = true
      } catch { refuse('BUNDLE_CLEANUP_BLOCKED') }
    })()
    return cleanup
  }
  try {
    const stat = await lstat(spec.parent)
    if (!stat.isDirectory() || stat.isSymbolicLink()) refuse('BUNDLE_PARENT_INVALID')
    const parent = await realpath(spec.parent)
    if (parent.split(/[\\/]/).some(part => /^(?:node_modules|\.codex|\.sandbox(?:-bin|-secrets)?)$/i.test(part))) {
      refuse('BUNDLE_PARENT_INVALID')
    }
    // All three existing sources must pass before a destination is allocated.
    for (const pin of pins) await verifiedCopy(spec.sources[pin.role], pin)
    directory = await mkdtemp(join(parent, 'dsh-codex-tools-'))
    identity = await lstat(directory)
    for (const pin of pins) await verifiedCopy(spec.sources[pin.role], pin, join(directory, pin.fileName))
    const receipt = { version: 1, status: 'SANDBOX_TOOL_BUNDLE_PREPARED_NOT_ACTIVATED', codexVersion: manifest.codexVersion,
      target: manifest.target, manifestSha256: sha256(JSON.stringify(manifest)), files: pins,
      systemChangesAuthorized: false, executionAuthorized: false, runtimeCompatibilityVerified: false, productAccepted: false }
    const manifestText = JSON.stringify(receipt, null, 2) + '\n'
    await writeFile(join(directory, 'bundle-manifest.json'), manifestText, { flag: 'wx', mode: 0o600 })
    const verify = async () => {
      try {
        if (disposed) refuse('BUNDLE_DISPOSED')
        await assertOwned()
        if ((await readdir(directory)).sort().join('\0') !== expectedNames.join('\0')) refuse('BUNDLE_CONTENT_CHANGED')
        const manifestPath = join(directory, 'bundle-manifest.json'), state = await lstat(manifestPath)
        if (!state.isFile() || state.isSymbolicLink() || state.size !== Buffer.byteLength(manifestText)
          || await readFile(manifestPath, 'utf8') !== manifestText) refuse('BUNDLE_CONTENT_CHANGED')
        for (const pin of pins) {
          const path = join(directory, pin.fileName), state = await lstat(path)
          if (state.nlink !== 1) refuse('BUNDLE_CONTENT_CHANGED')
          await verifiedCopy(path, pin)
        }
        return receipt
      } catch (error) {
        if (error instanceof SandboxBundleError) throw error
        refuse('BUNDLE_CONTENT_CHANGED')
      }
    }
    await verify()
    return Object.freeze({ directory, receipt: Object.freeze(receipt), verify, dispose })
  } catch (error) {
    if (directory && identity) await dispose()
    if (error instanceof SandboxBundleError) throw error
    refuse('BUNDLE_PREPARATION_FAILED')
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const args = process.argv.slice(2), values = Object.create(null)
    if (args.length !== 8 && args.length !== 10) refuse('BUNDLE_ARGUMENTS_INVALID')
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index].slice(2)
      if (args[index] !== '--' + key || !['parent', 'codex', 'setup', 'runner', 'version'].includes(key)
        || Object.hasOwn(values, key)) refuse('BUNDLE_ARGUMENTS_INVALID')
      values[key] = args[index + 1]
    }
    if (!['parent', 'codex', 'setup', 'runner'].every(key => Object.hasOwn(values, key))) refuse('BUNDLE_ARGUMENTS_INVALID')
    const version = values.version ?? currentVersion
    if (!stableVersion(version)) refuse('BUNDLE_VERSION_INVALID')
    let manifest
    try {
      manifest = JSON.parse(await readFile(new URL(`./sandbox-tool-bundle.${version}.json`, import.meta.url), 'utf8'))
    } catch { refuse('BUNDLE_VERSION_UNAVAILABLE') }
    if (manifest.codexVersion !== version) refuse('BUNDLE_MANIFEST_INVALID')
    const bundle = await prepareSandboxToolBundle({ parent: values.parent,
      sources: { codex: values.codex, setup: values.setup, runner: values.runner } }, manifest)
    process.stdout.write(JSON.stringify({ ...bundle.receipt, directory: bundle.directory }) + '\n')
  } catch (error) {
    process.stderr.write((error instanceof SandboxBundleError ? error.code : 'BUNDLE_PREPARATION_FAILED') + '\n')
    process.exitCode = 2
  }
}
