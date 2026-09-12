import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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
  await json(join(platform, 'package.json'), { name: '@openai/codex-win32-x64', version: '0.154.0' })
  if (stored) {
    const link = join(root, 'packages/subagent/subagent-codex/node_modules/@openai/codex')
    await mkdir(dirname(link), { recursive: true })
    await symlink(cli, link, process.platform === 'win32' ? 'junction' : 'dir')
  }
  const bin = join(platform, 'vendor/x86_64-pc-windows-msvc/bin')
  await mkdir(bin, { recursive: true })
  const manifest = { codexVersion: '0.154.0', target: 'x86_64-pc-windows-msvc', artifacts: [] }
  for (const [role, fileName] of Object.entries({ codex: 'codex.exe', setup: 'codex-windows-sandbox-setup.exe', runner: 'codex-command-runner.exe' })) {
    const bytes = Buffer.from('SYNTHETIC-' + role)
    await writeFile(join(bin, fileName), bytes)
    manifest.artifacts.push({ role, fileName, bytes: bytes.length, sha256: digest(bytes) })
  }
  return { home, root, owner, cli, platform, bin, manifest }
}
const code = text => error => error.message.includes(text)

for (const stored of [false, true]) test(`resolves and verifies the provider-owned ${stored ? 'linked' : 'hoisted'} package without store-name assumptions`, async t => {
  const f = await fixture(t, stored)
  const tools = await resolveProjectCodexTools(f.root, f.manifest)
  assert.equal(tools.version, '0.154.0')
  assert.equal(tools.sources.codex, join(f.bin, 'codex.exe'))
  assert.equal(Object.keys(tools.sources).length, 3)
  assert.deepEqual((await readdir(f.bin)).sort(), f.manifest.artifacts.map(pin => pin.fileName).sort())
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
  await writeFile(join(f.bin, runner.fileName), Buffer.alloc(runner.bytes, 65))
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), code('CODEX_TOOL_DIGEST_MISMATCH'))
})

test('refuses missing helpers instead of falling back to old binaries', async t => {
  const f = await fixture(t)
  await unlink(join(f.bin, 'codex-windows-sandbox-setup.exe'))
  await assert.rejects(resolveProjectCodexTools(f.root, f.manifest), error => error.code === 'ENOENT')
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
