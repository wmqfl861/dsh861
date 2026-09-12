/** Read project-owned Codex package metadata and verify its pinned Windows tools without execution. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'

/**
 * Resolve from the provider's installed dependency, never a pnpm-store spelling or PATH.
 * The supplied release manifest is trusted repository data, not a caller-supplied approval.
 * Paths and digests are checked at inspection; the caller protects installation files until use.
 * @param {string} repositoryRoot - absolute project directory owning the provider installation.
 * @param {object} manifest - reviewed Windows x64 release manifest with three exact file pins.
 * @returns {Promise<{version:string, sources:Record<string,string>}>} verified local files; no program is started.
 */
export async function resolveProjectCodexTools(repositoryRoot, manifest) {
  const root = await realpath(repositoryRoot)
  const projectPath = async path => {
    const resolved = await realpath(path)
    const part = relative(root, resolved)
    assert.ok(part !== '' && part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part), 'CODEX_PACKAGE_OUTSIDE_PROJECT')
    return resolved
  }
  const ownerFile = await projectPath(join(root, 'packages/subagent/subagent-codex/package.json'))
  const owner = JSON.parse(await readFile(ownerFile, 'utf8'))
  const version = owner.dependencies['@openai/codex']
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'CODEX_DEPENDENCY_NOT_PINNED')
  assert.equal(manifest.codexVersion, version, 'CODEX_MANIFEST_VERSION_MISMATCH')
  assert.equal(manifest.target, 'x86_64-pc-windows-msvc', 'CODEX_MANIFEST_TARGET_MISMATCH')
  const cliFile = await projectPath(createRequire(ownerFile).resolve('@openai/codex/package.json'))
  const cli = JSON.parse(await readFile(cliFile, 'utf8'))
  assert.equal(cli.name, '@openai/codex', 'CODEX_PACKAGE_NAME_MISMATCH')
  assert.equal(cli.version, version, 'CODEX_PACKAGE_VERSION_MISMATCH')
  const platformFile = await projectPath(createRequire(cliFile).resolve('@openai/codex-win32-x64/package.json'))
  const bin = join(dirname(platformFile), 'vendor', manifest.target, 'bin')
  const names = { codex: 'codex.exe', setup: 'codex-windows-sandbox-setup.exe', runner: 'codex-command-runner.exe' }
  assert.equal(manifest.artifacts.length, 3, 'CODEX_MANIFEST_FILES_MISMATCH')
  const sources = {}
  for (const [role, fileName] of Object.entries(names)) {
    const pins = manifest.artifacts.filter(pin => pin.role === role)
    assert.equal(pins.length, 1, 'CODEX_MANIFEST_FILES_MISMATCH')
    const pin = pins[0]
    assert.equal(pin.fileName, fileName, 'CODEX_MANIFEST_FILES_MISMATCH')
    const file = await projectPath(join(bin, fileName))
    const before = await stat(file)
    assert.ok(before.isFile(), 'CODEX_TOOL_NOT_FILE')
    assert.equal(before.size, pin.bytes, 'CODEX_TOOL_SIZE_MISMATCH')
    const hash = createHash('sha256')
    let length = 0
    for await (const chunk of createReadStream(file)) {
      length += chunk.length
      assert.ok(length <= pin.bytes, 'CODEX_TOOL_SIZE_MISMATCH')
      hash.update(chunk)
    }
    assert.equal(length, pin.bytes, 'CODEX_TOOL_SIZE_MISMATCH')
    assert.equal(hash.digest('hex'), pin.sha256, 'CODEX_TOOL_DIGEST_MISMATCH')
    sources[role] = file
  }
  return { version, sources }
}
