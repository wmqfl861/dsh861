import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { acceptanceMapErrors, foundationErrors, verifyCandidate } from './audit-controls.mjs'
import { renderStatus } from './sync-node-status.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// Normal repository runs use the supported tsx ESM hook. Offline audit runs may
// explicitly supply the output of a focused TypeScript compile (not a full build).
const compiled = process.env.P0B_AUDIT_RUNNER_MODULE
const runner = compiled ? resolve(compiled) : join(here, 'validate-harness.ts')
const prefix = compiled ? [] : ['--import', 'tsx/esm']
const hash = value => createHash('sha256').update(value).digest('hex')
function owned(t) {
  const root = mkdtempSync(join(tmpdir(), 'dsh861-audit-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
function run(args, env = {}) {
  return spawnSync(process.execPath, [...prefix, runner, ...args], {
    encoding: 'utf8', env: { ...process.env, ...env }, timeout: 10000,
  })
}
function blocked(root) {
  const result = run(['--harness', 'codex', '--case', 'allow', '--source', '--root', root])
  assert.equal(result.status, 2, result.stderr)
  return JSON.parse(result.stdout)
}

for (const harness of ['codex', 'claude-code', 'opencode', 'grok']) {
  for (const mode of ['--source', '--artifact']) {
    test(`${harness} ${mode}: BLOCKED exits 2 and retains evidence`, t => {
      const root = owned(t)
      const result = run(['--harness', harness, '--case', 'deny', mode, '--expect-denied',
        '--require-real-product', '--root', root], { DSH_AUDIT_FAKE_SECRET: 'synthetic-only-value-do-not-log-861' })
      assert.equal(result.status, 2, result.stderr)
      const e = JSON.parse(result.stdout)
      assert.equal(e.status, 'BLOCKED')
      assert.equal(e.requireRealProduct, true)
      assert.equal(e.cleanup.rootRemoved, false)
      assert.equal(existsSync(join(e.directories.root, 'result.json')), true)
      assert.deepEqual(JSON.parse(readFileSync(join(e.directories.root, 'manifest.json'), 'utf8')), e)
      assert.deepEqual(foundationErrors(e), [])
      assert.equal(result.stdout.includes('synthetic-only-value-do-not-log-861'), false)
      assert.equal(result.stderr.includes('synthetic-only-value-do-not-log-861'), false)
    })
  }
}

const invalid = [
  ['--unknown', 'value'], ['--harness', 'grok'], ['--harness=codex'], ['--case', 'deny'],
  ['--root', '/another'], ['--source'], ['--artifact'], ['--source=true'],
  ['--require-real-product=true'], ['--expect-denied'], ['--root='], ['extra'],
  ['--schema', 'p0-b-evidence.v2'], ['--require-real-product', '--require-real-product'],
]
for (const [index, extra] of invalid.entries()) {
  test(`reject ambiguous/unknown options ${index + 1}`, t => {
    const root = owned(t)
    const result = run(['--harness', 'codex', '--case', 'allow', '--source', '--root', root, ...extra])
    assert.equal(result.error, undefined)
    assert.equal(result.signal, null)
    assert.equal(result.status, 1, result.stderr)
    assert.equal(result.stdout, '')
  })
}

test('value options accept equals form and legacy records remain v1', t => {
  const root = owned(t)
  const result = run(['--harness=codex', '--case=allow', '--source', `--root=${root}`])
  assert.equal(result.status, 2, result.stderr)
  assert.equal(JSON.parse(result.stdout).planVersion, 'v1')
})

test('module import has no CLI side effects', () => {
  const result = spawnSync(process.execPath, [...prefix, '--input-type=module', '-e',
    `await import(${JSON.stringify(pathToFileURL(runner).href)})`], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
})

test('counterfeit PASS and invented observations cannot pass foundation guard', t => {
  const e = blocked(owned(t))
  assert.deepEqual(foundationErrors(e), [])
  assert.ok(foundationErrors({ ...e, status: 'PASS' }).length > 0)
  assert.ok(foundationErrors({ ...e, blockedConditions: [] }).length > 0)
  assert.ok(foundationErrors({ ...e, process: { ...e.process, during: [{ pid: 123 }] } }).length > 0)
  assert.ok(foundationErrors({ ...e, usage: { ...e.usage, value: { tokens: 1 } } }).length > 0)
  assert.ok(foundationErrors(null).length > 0)
})

test('foundation CLI separates invalid evidence from valid BLOCKED', t => {
  const root = owned(t)
  const e = blocked(root)
  const file = join(root, 'evidence.json')
  const invoke = () => spawnSync(process.execPath, [join(here, 'audit-controls.mjs'), 'foundation', '--evidence', file], { encoding: 'utf8' })
  writeFileSync(file, JSON.stringify(e))
  assert.equal(invoke().status, 2)
  writeFileSync(file, JSON.stringify({ ...e, status: 'PASS' }))
  assert.equal(invoke().status, 1)
})

test('candidate byte mismatch stays failure even when explained by line endings', t => {
  const root = owned(t)
  const lf = Buffer.from('first\nsecond\n')
  const crlf = Buffer.from('first\r\nsecond\r\n')
  writeFileSync(join(root, 'evidence.txt'), lf)
  const entry = { path: 'evidence.txt', type: 'file', bytes: crlf.length, sha256: hash(crlf) }
  const mismatch = verifyCandidate({ files: [entry] }, { root })
  assert.equal(mismatch.passed, false)
  assert.equal(mismatch.files[0].normalizationHint, 'LF_CRLF_ONLY_NOT_ACCEPTED')
  assert.equal(verifyCandidate({ files: [{ ...entry, bytes: lf.length, sha256: hash(lf) }] }, { root }).passed, true)
  assert.throws(() => verifyCandidate({ files: [entry, entry] }, { root }))
  assert.throws(() => verifyCandidate({ files: [] }, { root }))
  assert.throws(() => verifyCandidate({ files: [{ ...entry, path: '../outside' }] }, { root }))
  assert.throws(() => verifyCandidate({ files: [{ ...entry, type: 'symlink' }] }, { root }))
})

test('candidate rejects outward symlinks and missing files', t => {
  const root = owned(t)
  const outside = owned(t)
  writeFileSync(join(outside, 'private.txt'), 'synthetic')
  // A directory junction exercises the same containment check without requiring
  // Windows symlink privileges. All targets belong to this test.
  symlinkSync(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  const e = { path: 'escape/private.txt', type: 'file', bytes: 9, sha256: hash('synthetic') }
  assert.equal(verifyCandidate({ files: [e] }, { root }).passed, false)
  assert.equal(verifyCandidate({ files: [{ ...e, path: 'missing' }] }, { root }).passed, false)
})

test('Git candidate mode reads frozen blob bytes rather than modified checkout', t => {
  const root = owned(t)
  const git = args => execFileSync('git', ['-C', root, '-c', `core.hooksPath=${join(root, 'no-hooks')}`, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  git(['init'])
  writeFileSync(join(root, '.gitattributes'), '* -text\n')
  writeFileSync(join(root, 'item.txt'), 'frozen\n')
  git(['add', '.'])
  git(['-c', 'user.name=Offline audit fixture', '-c', 'user.email=audit@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', 'synthetic fixture'])
  const commit = git(['rev-parse', 'HEAD']).trim()
  writeFileSync(join(root, 'item.txt'), 'changed\r\n')
  const manifest = { files: [{ path: 'item.txt', type: 'file', bytes: 7, sha256: hash('frozen\n') }] }
  assert.equal(verifyCandidate(manifest, { root, commit }).passed, true)
  assert.equal(verifyCandidate(manifest, { root }).passed, false)
  assert.throws(() => verifyCandidate(manifest, { root, commit: 'HEAD' }))
})

test('status projection is deterministic and cannot silently open a gate', () => {
  const state = { node: 'P0-B', status: 'blocked', plan_version: 'v3', hard_review: null,
    candidate: null, product_acceptance_completed: [], next_node_allowed: false,
    current_activity: 'Awaiting designated planner', blocker: 'PLAN_REVISION_REQUIRED' }
  const output = renderStatus('P0-B', [state])
  assert.equal(output, renderStatus('P0-B', [state]))
  assert.ok(output.includes('**不允许**'))
  assert.throws(() => renderStatus('P0-B', [{ ...state, next_node_allowed: true }]))
  assert.throws(() => renderStatus('P0-B', [state, state]))
  assert.throws(() => renderStatus('P0-C', [state]))
})


test('AC map rejects renamed, missing and duplicate acceptance contracts', () => {
  const spec = '版本：1.0。\n' + Array.from({ length: 32 }, (_, i) =>
    `| AC-${String(i + 1).padStart(2, '0')} | title-${i + 1} | condition |`).join('\n')
  const mapping = { requirementsVersion: '1.0', definitions: { 'AC-04': 'title-4' },
    cases: [{ caseId: 'P0B-HANDOFF-01', productAc: ['AC-04'], coverage: 'PARTIAL' }] }
  assert.deepEqual(acceptanceMapErrors(mapping, spec), [])
  assert.ok(acceptanceMapErrors({ ...mapping, definitions: { 'AC-04': 'model settings' } }, spec).length > 0)
  assert.ok(acceptanceMapErrors(mapping, spec.split('\n').slice(0, 5).join('\n')).length > 0)
  assert.ok(acceptanceMapErrors({ ...mapping, cases: [...mapping.cases, ...mapping.cases] }, spec).length > 0)
  assert.ok(acceptanceMapErrors({ ...mapping, cases: [{ ...mapping.cases[0], coverage: 'PASS' }] }, spec).length > 0)
})
