import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { link, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { prepareSandboxToolBundle } from './prepare-sandbox-tool-bundle.mjs'

const script = fileURLToPath(new URL('./prepare-sandbox-tool-bundle.mjs', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('./sandbox-tool-bundle.0.149.1.json', import.meta.url), 'utf8'))
const digest = data => createHash('sha256').update(data).digest('hex')
const code = expected => error => error.code === expected

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-bundle-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const source = join(root, 'source'), parent = join(root, 'staging')
  await mkdir(source); await mkdir(parent)
  const pins = structuredClone(manifest), sources = {}
  for (const pin of pins.artifacts) {
    // Synthetic non-executable bytes: no Windows program or elevated setup is started.
    const bytes = Buffer.from('SYNTHETIC-' + pin.role + '\n')
    pin.bytes = bytes.length; pin.sha256 = digest(bytes)
    sources[pin.role] = join(source, pin.fileName)
    await writeFile(sources[pin.role], bytes)
  }
  const spec = { parent, sources }
  return { root, parent, source, sources, pins, spec, prepare: () => prepareSandboxToolBundle(spec, pins) }
}

test('three verified copies use native adjacent names without activating a program', async t => {
  const f = await fixture(t), bundle = await f.prepare()
  assert.equal(bundle.receipt.status, 'SANDBOX_TOOL_BUNDLE_PREPARED_NOT_ACTIVATED')
  assert.equal(bundle.receipt.systemChangesAuthorized, false)
  assert.equal(bundle.receipt.executionAuthorized, false)
  assert.equal(bundle.receipt.runtimeCompatibilityVerified, false)
  assert.equal(bundle.receipt.productAccepted, false)
  assert.deepEqual((await readdir(bundle.directory)).sort(), ['bundle-manifest.json', ...f.pins.artifacts.map(a => a.fileName)].sort())
  for (const pin of f.pins.artifacts) assert.deepEqual(await readFile(join(bundle.directory, pin.fileName)), await readFile(f.sources[pin.role]))
  assert.equal((await bundle.verify()).files.length, 3)
  await bundle.dispose()
  assert.deepEqual(await readdir(f.parent), [])
  assert.equal((await readdir(f.source)).length, 3)
})

for (const role of ['codex', 'setup', 'runner']) {
  test('missing ' + role + ' fails before creating any destination', async t => {
    const f = await fixture(t); await unlink(f.sources[role])
    await assert.rejects(f.prepare(), code('BUNDLE_PREPARATION_FAILED'))
    assert.deepEqual(await readdir(f.parent), [])
  })
  test('wrong ' + role + ' digest is refused without preparing a partial bundle', async t => {
    const f = await fixture(t)
    f.pins.artifacts.find(pin => pin.role === role).sha256 = '0'.repeat(64)
    await assert.rejects(f.prepare(), code('BUNDLE_DIGEST_MISMATCH'))
    assert.deepEqual(await readdir(f.parent), [])
  })
}

test('pinned sizes reject truncation or extra bytes before copying', async t => {
  const f = await fixture(t)
  await writeFile(f.sources.setup, 'changed length')
  await assert.rejects(f.prepare(), code('BUNDLE_SOURCE_INVALID'))
  assert.deepEqual(await readdir(f.parent), [])
})

test('sources and the reviewed manifest are snapshotted before asynchronous work', async t => {
  const f = await fixture(t), pending = f.prepare()
  f.spec.sources.runner = '/unrelated'; f.pins.artifacts[2].sha256 = '0'.repeat(64)
  const bundle = await pending
  await bundle.verify(); await bundle.dispose()
})

test('bundled files are independent of subsequent source changes and returned pins are immutable', async t => {
  const f = await fixture(t), bundle = await f.prepare()
  await writeFile(f.sources.codex, 'later source change')
  assert.throws(() => { bundle.receipt.files[0].sha256 = '0'.repeat(64) }, TypeError)
  assert.throws(() => { bundle.receipt.files.push({}) }, TypeError)
  await bundle.verify(); await bundle.dispose()
})

test('tampered bundled bytes cannot pass whole-bundle verification', async t => {
  const f = await fixture(t), bundle = await f.prepare()
  const file = join(bundle.directory, 'codex-command-runner.exe'), bytes = await readFile(file)
  bytes[0] ^= 1; await writeFile(file, bytes)
  await assert.rejects(bundle.verify(), code('BUNDLE_DIGEST_MISMATCH'))
  await bundle.dispose()
})

test('missing file and modified receipt cannot pass verification', async t => {
  const f = await fixture(t), one = await f.prepare(), two = await f.prepare()
  await unlink(join(one.directory, 'codex.exe'))
  await assert.rejects(one.verify(), code('BUNDLE_CONTENT_CHANGED'))
  await writeFile(join(two.directory, 'bundle-manifest.json'), '{}\n')
  await assert.rejects(two.verify(), code('BUNDLE_CONTENT_CHANGED'))
  await one.dispose(); await two.dispose()
})

test('extra files block verification and cleanup rather than deleting unowned content', async t => {
  const f = await fixture(t), bundle = await f.prepare()
  const unknown = join(bundle.directory, 'not-owned.txt'); await writeFile(unknown, 'retain')
  await assert.rejects(bundle.verify(), code('BUNDLE_CONTENT_CHANGED'))
  await assert.rejects(bundle.dispose(), code('BUNDLE_CLEANUP_BLOCKED'))
  assert.equal(await readFile(unknown, 'utf8'), 'retain')
})

test('changed root identity is preserved, not recursively traversed', async t => {
  const f = await fixture(t), bundle = await f.prepare(), moved = join(f.root, 'retained')
  await rename(bundle.directory, moved); await mkdir(bundle.directory)
  await writeFile(join(bundle.directory, 'foreign.txt'), 'keep')
  await assert.rejects(bundle.verify(), code('BUNDLE_IDENTITY_CHANGED'))
  await assert.rejects(bundle.dispose(), code('BUNDLE_CLEANUP_BLOCKED'))
  assert.equal(await readFile(join(bundle.directory, 'foreign.txt'), 'utf8'), 'keep')
})

test('a junction in a known output slot is unlinked without visiting its target', async t => {
  const f = await fixture(t), bundle = await f.prepare()
  const target = join(f.root, 'external'); await mkdir(target); await writeFile(join(target, 'keep'), 'outside')
  const slot = join(bundle.directory, 'codex.exe'); await unlink(slot)
  await symlink(target, slot, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(bundle.verify())
  await bundle.dispose()
  assert.equal(await readFile(join(target, 'keep'), 'utf8'), 'outside')
})

test('a linked staging parent is rejected without entering its target', async t => {
  const f = await fixture(t), target = join(f.root, 'actual')
  await mkdir(target); await rmdir(f.parent)
  await symlink(target, f.parent, process.platform === 'win32' ? 'junction' : 'dir')
  try {
    await assert.rejects(f.prepare(), code('BUNDLE_PARENT_INVALID'))
    assert.deepEqual(await readdir(target), [])
  } finally { await unlink(f.parent) }
})

test('a directory cannot stand in for a program', async t => {
  const f = await fixture(t)
  await unlink(f.sources.runner); await mkdir(f.sources.runner)
  await assert.rejects(f.prepare(), code('BUNDLE_SOURCE_INVALID'))
})

test('hard-linked source is copied without linking the destination', async t => {
  const f = await fixture(t), alias = join(f.root, 'alias.exe')
  await link(f.sources.codex, alias); f.spec.sources.codex = alias
  const bundle = await f.prepare()
  await writeFile(alias, 'other bytes')
  await bundle.verify(); await bundle.dispose()
})

test('global Codex and node_modules are not staging destinations', async t => {
  const f = await fixture(t)
  for (const name of ['.codex', '.sandbox', '.sandbox-secrets', 'node_modules']) {
    const path = join(f.root, name); await mkdir(path); f.spec.parent = path
    await assert.rejects(f.prepare(), code('BUNDLE_PARENT_INVALID'))
    assert.deepEqual(await readdir(path), [])
  }
})

test('caller-defined output paths or duplicated roles cannot escape the fixed filenames', async t => {
  const f = await fixture(t)
  f.pins.artifacts[1].fileName = '../other.exe'
  await assert.rejects(f.prepare(), code('BUNDLE_MANIFEST_INVALID'))
  f.pins.artifacts[1] = f.pins.artifacts[0]
  await assert.rejects(f.prepare(), code('BUNDLE_MANIFEST_INVALID'))
})

test('concurrent preparations own separate directories and concurrent cleanup is joined', async t => {
  const f = await fixture(t), [one, two] = await Promise.all([f.prepare(), f.prepare()])
  assert.notEqual(one.directory, two.directory)
  await Promise.all([one.dispose(), one.dispose()]); await two.verify(); await two.dispose()
  await assert.rejects(one.verify(), code('BUNDLE_DISPOSED'))
  await one.dispose(); assert.deepEqual(await readdir(f.parent), [])
})

test('the CLI cannot override the checked-in pins and reports refusal without a filesystem path', async t => {
  const f = await fixture(t)
  const result = spawnSync(process.execPath, [script, '--parent', f.parent, '--codex', f.sources.codex,
    '--setup', f.sources.setup, '--runner', f.sources.runner], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'BUNDLE_SOURCE_INVALID\n')
  const unknown = spawnSync(process.execPath, [script, '--manifest', 'other'], { encoding: 'utf8', timeout: 10000 })
  assert.equal(unknown.status, 2); assert.equal(unknown.stderr, 'BUNDLE_ARGUMENTS_INVALID\n')
  assert.deepEqual(await readdir(f.parent), [])
})

test('checked-in release metadata pins raw x64 helpers, not compressed archive digests', () => {
  assert.equal(manifest.codexVersion, '0.149.1')
  const setup = manifest.artifacts.find(a => a.role === 'setup'), runner = manifest.artifacts.find(a => a.role === 'runner')
  assert.equal(setup.assetId, 526817936); assert.equal(setup.bytes, 15415088)
  assert.equal(runner.assetId, 526817940); assert.equal(runner.bytes, 8160560)
  for (const a of [setup, runner]) {
    assert.equal(a.downloadUrl, `https://github.com/openai/codex/releases/download/rust-v0.149.1/${a.assetName}`)
    assert.ok(a.assetName.endsWith('x86_64-pc-windows-msvc.exe'))
  }
})
