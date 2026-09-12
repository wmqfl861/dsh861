import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { prepareSandboxToolBundle } from './prepare-sandbox-tool-bundle.mjs'

const script = fileURLToPath(new URL('./prepare-sandbox-tool-bundle.mjs', import.meta.url))
const manifestFor = async version => JSON.parse(await readFile(new URL(`./sandbox-tool-bundle.${version}.json`, import.meta.url), 'utf8'))
const current = await manifestFor('0.154.0')
const legacy = await manifestFor('0.149.1')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

async function fixture(t, version = '0.154.0') {
  const root = await mkdtemp(join(tmpdir(), 'dsh-upgrade-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const staging = join(root, 'staging'), source = join(root, 'source'), entry = join(root, 'prepare.mjs')
  await mkdir(staging); await mkdir(source)
  // Rehost the unchanged CLI with explicitly synthetic adjacent manifests. This is not
  // an arbitrary-manifest option on the installed tool or publisher verification.
  await copyFile(script, entry)
  const manifest = structuredClone(version === '0.149.1' ? legacy : current)
  const sources = {}
  for (const pin of manifest.artifacts) {
    const bytes = Buffer.from(`SYNTHETIC-${version}-${pin.role}\n`)
    pin.bytes = bytes.length; pin.sha256 = hash(bytes)
    sources[pin.role] = join(source, pin.fileName)
    await writeFile(sources[pin.role], bytes)
  }
  const record = join(root, `sandbox-tool-bundle.${version}.json`)
  await writeFile(record, JSON.stringify(manifest))
  const args = ['--parent', staging, '--codex', sources.codex, '--setup', sources.setup, '--runner', sources.runner]
  const run = (...extra) => spawnSync(process.execPath, [entry, ...args, ...extra],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 })
  return { root, staging, entry, record, manifest, sources, args, run }
}

test('the default CLI prepares the checked-in current-version file set', async t => {
  const f = await fixture(t), result = f.run()
  assert.equal(result.status, 0, result.stderr)
  const receipt = JSON.parse(result.stdout)
  assert.equal(receipt.codexVersion, '0.154.0')
  assert.equal(receipt.executionAuthorized, false)
  assert.equal(receipt.systemChangesAuthorized, false)
  assert.equal(receipt.runtimeCompatibilityVerified, false)
  assert.equal(receipt.productAccepted, false)
  assert.equal((await readdir(receipt.directory)).length, 4)
})

test('explicit legacy selection reproduces old pins without making them the default', async t => {
  const f = await fixture(t, '0.149.1')
  const missingCurrent = f.run()
  assert.equal(missingCurrent.status, 2)
  assert.equal(missingCurrent.stderr, 'BUNDLE_VERSION_UNAVAILABLE\n')
  assert.deepEqual(await readdir(f.staging), [])
  const result = f.run('--version', '0.149.1')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).codexVersion, '0.149.1')
})

for (const version of ['../0.154.0', '0.154.0/../../outside', '0.154.0-rc.1', 'latest', '00.154.0']) {
  test(`invalid selector ${JSON.stringify(version)} cannot select a local path or floating release`, async t => {
    const f = await fixture(t), result = f.run('--version', version)
    assert.equal(result.status, 2)
    assert.equal(result.stderr, 'BUNDLE_VERSION_INVALID\n')
    assert.deepEqual(await readdir(f.staging), [])
  })
}

test('an unavailable fixed version never falls back to another version', async t => {
  const f = await fixture(t), result = f.run('--version', '0.155.0')
  assert.equal(result.status, 2)
  assert.equal(result.stderr, 'BUNDLE_VERSION_UNAVAILABLE\n')
  assert.deepEqual(await readdir(f.staging), [])
})

test('selected version must equal the adjacent manifest version', async t => {
  const f = await fixture(t)
  f.manifest.codexVersion = '0.149.1'
  await writeFile(f.record, JSON.stringify(f.manifest))
  const result = f.run()
  assert.equal(result.status, 2)
  assert.equal(result.stderr, 'BUNDLE_MANIFEST_INVALID\n')
  assert.deepEqual(await readdir(f.staging), [])
})

test('current and old helper bytes cannot be mixed even when both manifests are known', async t => {
  const f = await fixture(t)
  const pin = f.manifest.artifacts.find(value => value.role === 'runner')
  const wrong = Buffer.alloc(pin.bytes, 65)
  await writeFile(f.sources.runner, wrong)
  const result = f.run()
  assert.equal(result.status, 2)
  assert.equal(result.stderr, 'BUNDLE_DIGEST_MISMATCH\n')
  assert.deepEqual(await readdir(f.staging), [])
})

test('the API accepts a reviewed current manifest while preserving explicit release identity', async t => {
  const f = await fixture(t)
  const bundle = await prepareSandboxToolBundle({ parent: f.staging, sources: f.sources }, f.manifest)
  assert.equal((await bundle.verify()).codexVersion, '0.154.0')
  await bundle.dispose()
  f.manifest.codexVersion = 'latest'
  await assert.rejects(prepareSandboxToolBundle({ parent: f.staging, sources: f.sources }, f.manifest),
    error => error.code === 'BUNDLE_SPEC_INVALID')
})

test('the new release pins include the raw main executable and matching raw helpers', () => {
  assert.equal(current.releaseId, 385887902)
  assert.deepEqual(current.artifacts.map(pin => [pin.role, pin.assetId, pin.bytes]), [
    ['codex', 553706480, 298169136], ['setup', 553706488, 15467312], ['runner', 553706450, 8218416],
  ])
  for (const pin of current.artifacts) {
    assert.match(pin.downloadUrl, /^https:\/\/github\.com\/openai\/codex\/releases\/download\/rust-v0\.154\.0\//)
    assert.equal(pin.downloadUrl.endsWith('.exe'), true)
    assert.notEqual(pin.sha256, legacy.artifacts.find(value => value.role === pin.role).sha256)
  }
})
