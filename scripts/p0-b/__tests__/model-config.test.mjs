import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  AGENT_NAMES, assertUpgradePreservesModelConfig, configurationReport,
  publicConfigDigest, resolveApprovedRoute, validateModelConfig, verifyModelConfigLock,
} from '../model-config.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const cli = join(root, 'scripts/p0-b/model-config.mjs')
const configPath = join(root, 'config/agents/models.v1.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'config/agents/models.v1.lock.json'), 'utf8'))
const clone = () => structuredClone(config)
const invoke = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 })
function temporary(t) {
  const path = mkdtempSync(join(tmpdir(), 'dsh861-model-config-'))
  t.after(() => rmSync(path, { recursive: true, force: true }))
  return path
}

test('owner declarations and public lock validate, without product certification', () => {
  validateModelConfig(config)
  verifyModelConfigLock(config, lock)
  const report = configurationReport(config, lock)
  assert.equal(report.productAccepted, false)
  assert.equal(report.nativeCompatibility, 'NOT_RUN')
  assert.deepEqual(report.plaintextHttpRoutes, ['codex', 'claude-code', 'grok'])
  assert.ok(report.credentials.every(item => item.state === 'NOT_IMPORTED_BY_THIS_CHANGE'))
})

const wanted = {
  codex: ['my-gpt', 'gpt-6-astra', 'max'],
  'claude-code': ['my-claude', 'claude-opus-5', 'max'],
  grok: ['my-grok', 'grok-4.6', 'xhigh'],
  opencode: ['zhipuai-coding-plan', 'glm-5.3', 'max'],
}
for (const name of AGENT_NAMES) {
  test(`${name}: requested provider/model/effort retained exactly, no credential value`, () => {
    const route = resolveApprovedRoute(config, lock, name)
    assert.deepEqual([route.provider, route.model, route.reasoningEffort], wanted[name])
    assert.equal(route.credentialRef, `secret-reference:providers/${name}`)
    assert.equal(Object.hasOwn(route, 'apiKey'), false)
    assert.ok(Object.isFrozen(route))
    assert.throws(() => { route.model = 'other' })
    assert.equal(config.agents[name].model, wanted[name][1])
  })
}

test('URLs retain original path and trailing slash; builtin has no fabricated URL', () => {
  assert.equal(config.agents.codex.baseUrl, 'http://154.89.153.24:8080/v1')
  assert.equal(config.agents['claude-code'].baseUrl, 'http://154.89.153.24:8080/')
  assert.equal(config.agents.grok.baseUrl, config.agents.codex.baseUrl)
  assert.equal(config.agents.opencode.baseUrl, null)
})

test('canonical public digest ignores formatting and key order', () => {
  const reverse = value => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverse(child)])) : value
  assert.equal(publicConfigDigest(reverse(config)), publicConfigDigest(config))
  const parsed = JSON.parse(JSON.stringify(config, null, 4).replaceAll('\n', '\r\n'))
  assertUpgradePreservesModelConfig(config, parsed, lock)
})

for (const [field, value] of [['model', 'another-model'], ['provider', 'another-provider'],
  ['reasoningEffort', 'xhigh'], ['baseUrl', 'https://another.example.invalid/v1']]) {
  test(`CLI-only upgrade cannot change ${field}`, () => {
    const next = clone()
    next.agents.codex[field] = value
    assert.throws(() => assertUpgradePreservesModelConfig(config, next, lock), /MODEL_CONFIG_DRIFT/)
    assert.throws(() => verifyModelConfigLock(next, lock), /MODEL_CONFIG_LOCK_MISMATCH/)
  })
}

for (const [label, mutate] of [
  ['inline key', c => { c.agents.codex.apiKey = 'synthetic-not-a-credential' }],
  ['secret object', c => { c.secrets = { codex: 'synthetic-not-a-credential' } }],
  ['headers', c => { c.agents.codex.headers = { Authorization: 'synthetic-only' } }],
  ['missing agent', c => { delete c.agents.grok }],
  ['extra agent', c => { c.agents.other = c.agents.codex }],
  ['credential reference drift', c => { c.agents.codex.credentialRef = 'env:OTHER_API_KEY' }],
  ['global import', c => { c.credentialPolicy.allowGlobalHarnessImport = true }],
  ['inline credential permission', c => { c.credentialPolicy.allowValuesInRepository = true }],
  ['implicit model fallback', c => { c.upgradePolicy.allowImplicitModelFallback = true }],
  ['implicit effort fallback', c => { c.upgradePolicy.allowImplicitReasoningFallback = true }],
  ['implicit endpoint change', c => { c.upgradePolicy.allowImplicitEndpointChange = true }],
  ['unapproved auxiliary model', c => { c.upgradePolicy.allowUnapprovedAuxiliaryModels = true }],
  ['disable workflow pinning', c => { c.upgradePolicy.pinForWorkflow = false }],
  ['disable verification', c => { c.upgradePolicy.requireCompatibilityVerification = false }],
  ['builtin endpoint override', c => { c.agents.opencode.baseUrl = 'https://another.example.invalid' }],
  ['builtin provider replacement', c => { c.agents.opencode.provider = 'zai' }],
  ['credential-like model', c => { c.agents.codex.model = 'sk-' + 'x'.repeat(32) }],
]) {
  test(`reject ${label} without echoing values`, () => {
    const next = clone()
    mutate(next)
    assert.throws(() => validateModelConfig(next), /^Error: MODEL_[A-Z_]+$/)
  })
}

for (const url of ['https://user:password@example.invalid', 'https://example.invalid?token=synthetic',
  'https://example.invalid#token', 'file:///private/config', 'not a url', 'https://example.invalid/\n']) {
  test('reject credential-bearing or malformed endpoint: ' + (url.startsWith('https') ? 'https' : 'other'), () => {
    const next = clone()
    next.agents.codex.baseUrl = url
    assert.throws(() => validateModelConfig(next), /MODEL_ENDPOINT_INVALID/)
  })
}

test('reject invalid lock, digest, schema and unknown role', () => {
  assert.throws(() => verifyModelConfigLock(config, { ...lock, publicConfigSha256: '0'.repeat(64) }))
  assert.throws(() => verifyModelConfigLock(config, { ...lock, secret: 'synthetic' }))
  assert.throws(() => validateModelConfig(null))
  assert.throws(() => validateModelConfig({ ...config, schemaVersion: 'other' }))
  assert.throws(() => resolveApprovedRoute(config, lock, 'other'))
})

test('check CLI succeeds only for public configuration and does not change files', () => {
  const before = readFileSync(configPath)
  const inventory = readdirSync(join(root, 'config/agents'))
  const result = invoke(['check'])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).status, 'CONFIG_VALID_NOT_ACTIVATED')
  assert.equal(result.stderr, '')
  assert.deepEqual(readFileSync(configPath), before)
  assert.deepEqual(readdirSync(join(root, 'config/agents')), inventory)
})

test('compare-upgrade CLI passes unchanged and fails changed public declaration', t => {
  const path = join(temporary(t), 'candidate.json')
  writeFileSync(path, JSON.stringify(config))
  assert.equal(invoke(['compare-upgrade', '--candidate', path]).status, 0)
  const next = clone()
  next.agents.grok.model = 'grok-4.6-build'
  writeFileSync(path, JSON.stringify(next))
  const result = invoke(['compare-upgrade', '--candidate', path])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr.includes('grok-4.6-build'), false)
})

test('CLI never echoes corrupt file content or unknown arguments', t => {
  const marker = 'PRIVATE_SYNTHETIC_MARKER_NOT_A_KEY'
  const path = join(temporary(t), 'bad.json')
  writeFileSync(path, '{' + marker)
  for (const args of [['compare-upgrade', '--candidate', path], ['check', marker], ['--api-key', marker]]) {
    const result = invoke(args)
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr.includes(marker), false)
  }
})

test('module import alone causes no CLI output', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `await import(${JSON.stringify(pathToFileURL(cli).href)})`], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})
