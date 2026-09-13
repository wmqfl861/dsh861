import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { resolveProjectCodexTools } from './codex-installed-tools.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function json(file, data) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data))
}
async function fixture(t, stored = false) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-codex-resolution-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const root = join(home, 'project'), owner = join(root, 'packages/subagent/subagent-codex/package.json')
  await json(owner, { dependencies: { '@openai/codex': '0.154.0' } })
  const scope = join(root, stored ? 'node_modules/.arbitrary-store/current/node_modules/@openai' : 'node_modules/@openai')
  const cli = join(scope, 'codex'), platform = join(scope, 'codex-win32-x64')
  await json(join(cli, 'package.json'), { name: '@openai/codex', version: '0.154.0' })
  await json(join(platform, 'package.json'), { name: '@openai/codex', version: '0.154.0' })
  if (stored) {
    const link = join(root, 'packages/subagent/subagent-codex/node_modules/@openai/codex')
    await mkdir(dirname(link), { recursive: true })
    await symlink(cli, link, process.platform === 'win32' ? 'junction' : 'dir')
  }
  const target = join(platform, 'vendor/x86_64-pc-windows-msvc')
  // Installed 0.154.0 layout: self-describing codex-package.json, main under bin/, helpers under codex-resources/.
  await json(join(target, 'codex-package.json'), { layoutVersion: 1, version: '0.154.0', target: 'x86_64-pc-windows-msvc',
    variant: 'codex', entrypoint: 'bin/codex.exe', resourcesDir: 'codex-resources', pathDir: 'codex-path' })
  const bin = join(target, 'bin'), resources = join(target, 'codex-resources')
  const places = { codex: join(bin, 'codex.exe'),
    setup: join(resources, 'codex-windows-sandbox-setup.exe'), runner: join(resources, 'codex-command-runner.exe') }
  const manifest = { codexVersion: '0.154.0', target: 'x86_64-pc-windows-msvc', artifacts: [] }
  for (const [role, file] of Object.entries(places)) {
    const bytes = Buffer.from('SYNTHETIC-' + role)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, bytes)
    manifest.artifacts.push({ role, fileName: basename(file), bytes: bytes.length, sha256: digest(bytes) })
  }
  return { home, root, owner, cli, platform, bin, resources, places, manifest }
}
const code = text => error => error.message.includes(text)

for (const stored of [false, true]) test(`resolves and verifies the provider-owned ${stored ? 'linked' : 'hoisted'} package without store-name assumptions`, async t => {
  const f = await fixture(t, stored)
  const tools = await resolveProjectCodexTools(f.root, f.manifest)
  assert.equal(tools.version, '0.154.0')
  // The resolver returns realpath-normalized files; TEMP may carry Windows 8.3 short names.
  assert.equal(tools.sources.codex, join(await realpath(f.bin), 'codex.exe'))
  assert.equal(tools.sources.setup, join(await realpath(f.resources), 'codex-windows-sandbox-setup.exe'))
  assert.equal(tools.sources.runner, join(await realpath(f.resources), 'codex-command-runner.exe'))
  assert.equal(Object.keys(tools.sources).length, 3)
  assert.deepEqual((await readdir(f.bin)).sort(), ['codex.exe'])
  assert.deepEqual((await readdir(f.resources)).sort(), ['codex-command-runner.exe', 'codex-windows-sandbox-setup.exe'])
})

test('does not reuse a manifest for a different declared release', async t => {
  const f = await fixture(t)
  f.manifest.codexVersion = '0.149.1'
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_MANIFEST_VERSION_MISMATCH'))
})

test('rejects a floating provider declaration', async t => {
  const f = await fixture(t)
  await json(f.owner, { dependencies: { '@openai/codex': '^0.154.0' } })
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_DEPENDENCY_NOT_PINNED'))
})

test('rejects stale installed metadata despite a current manifest', async t => {
  const f = await fixture(t)
  await json(join(f.cli, 'package.json'), { name: '@openai/codex', version: '0.149.1' })
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_PACKAGE_VERSION_MISMATCH'))
})

test('verifies helper bytes, not only the main executable', async t => {
  const f = await fixture(t)
  const runner = f.manifest.artifacts.find(pin => pin.role === 'runner')
  await writeFile(f.places.runner, Buffer.alloc(runner.bytes, 65))
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_TOOL_DIGEST_MISMATCH'))
})

test('refuses missing helpers instead of falling back to old binaries', async t => {
  const f = await fixture(t)
  await unlink(f.places.setup)
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), error => error.code === 'ENOENT')
})

test('refuses helpers outside the declared resources directory', async t => {
  const f = await fixture(t)
  // A byte-identical copy misplaced under bin/ must not satisfy the resourcesDir pin.
  const { readFile } = await import('node:fs/promises')
  await writeFile(join(f.bin, 'codex-windows-sandbox-setup.exe'), await readFile(f.places.setup))
  await unlink(f.places.setup)
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), error => error.code === 'ENOENT')
})

test('rejects installed layout metadata for a different release', async t => {
  const f = await fixture(t)
  const layoutFile = join(f.platform, 'vendor/x86_64-pc-windows-msvc/codex-package.json')
  await json(layoutFile, { layoutVersion: 1, version: '0.149.1', target: 'x86_64-pc-windows-msvc',
    variant: 'codex', entrypoint: 'bin/codex.exe', resourcesDir: 'codex-resources', pathDir: 'codex-path' })
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_LAYOUT_VERSION_MISMATCH'))
})

test('does not resolve a platform package linked outside the project', async t => {
  const f = await fixture(t), outside = join(f.home, 'foreign-package')
  await json(join(outside, 'package.json'), { name: '@openai/codex-win32-x64', version: '0.154.0' })
  await rm(f.platform, { recursive: true })
  await symlink(outside, f.platform, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_PACKAGE_OUTSIDE_PROJECT'))
})

test('refuses a wrong native target without selecting a different architecture', async t => {
  const f = await fixture(t)
  f.manifest.target = 'aarch64-pc-windows-msvc'
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_MANIFEST_TARGET_MISMATCH'))
})
