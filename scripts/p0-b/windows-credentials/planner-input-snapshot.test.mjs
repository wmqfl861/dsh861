import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync,
  rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { devNull, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { publicConfigDigest } from '../model-config.mjs'
import { preparePlannerInputSnapshot } from './planner-input-snapshot.mjs'

// Real local Git, raw blobs, files and projection. No network, credentials, signer or model process.
const root = fileURLToPath(new URL('../../../', import.meta.url))
const config = JSON.parse(readFileSync(join(root, 'config/agents/models.v1.json'), 'utf8'))
const lock = JSON.parse(readFileSync(join(root, 'config/agents/models.v1.lock.json'), 'utf8'))
const gitExecutable = realpathSync(execFileSync(process.platform === 'win32' ? 'where.exe' : 'which',
  [process.platform === 'win32' ? 'git.exe' : 'git'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0])
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const gitSha256 = hash(readFileSync(gitExecutable))
const executableSha256 = hash(readFileSync(process.execPath))
const data = Buffer.from('固定输入\r\nline two\r\n')
const code = expected => error => error.code === expected && error.message === expected && error.cause === undefined

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'dsh-input-test-'))
  const disposers = []
  t.after(async () => {
    for (const dispose of disposers.reverse()) await dispose()
    rmSync(base, { recursive: true, force: true })
  })
  const repository = join(base, 'repo'), parent = join(base, 'snapshots')
  mkdirSync(repository); mkdirSync(parent)
  const env = { HOME: base, USERPROFILE: base, TEMP: base, TMP: base,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull, GIT_TERMINAL_PROMPT: '0',
    ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}) }
  const git = (args, input) => execFileSync(gitExecutable, ['-c', 'core.autocrlf=false',
    '-c', 'core.hooksPath=' + join(base, 'no-hooks'), '-c', 'commit.gpgSign=false',
    '-c', 'user.name=Snapshot Fixture', '-c', 'user.email=snapshot@example.invalid', '-C', repository, ...args],
  { env, input, encoding: null, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
  git(['init', '-q'])
  mkdirSync(join(repository, 'docs'))
  writeFileSync(join(repository, 'docs/input.txt'), data)
  writeFileSync(join(repository, 'not-selected.txt'), 'not in read set')
  git(['add', '--', 'docs/input.txt', 'not-selected.txt']); git(['commit', '-qm', 'synthetic input'])
  const sourceCommit = git(['rev-parse', 'HEAD']).toString().trim()
  const configuration = structuredClone(config)
  configuration.agents.codex.baseUrl = 'https://snapshot.example.invalid/v1'
  const prompt = join(base, 'prompt.txt'); writeFileSync(prompt, 'synthetic prompt')
  const input = { sourceCommit, readSet: [{ path: 'docs/input.txt', sha256: hash(data) }],
    run: { configuration, trustedLock: { ...lock, publicConfigSha256: publicConfigDigest(configuration) },
      input: { platform: process.platform, workspace: repository, runRoot: join(base, 'run'),
        executable: process.execPath, executableSha256, systemRoot: process.platform === 'win32' ? process.env.SystemRoot : null,
        toolDirectories: [dirname(process.execPath)] },
      prompt: { file: prompt, sha256: hash(readFileSync(prompt)) },
      bounds: { deadlineMs: 1000, terminationGraceMs: 200, maxChannelBytes: 4096,
        redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 } },
      jobOwner: { powershellExecutable: process.execPath, directory: base,
        sha256: { executable: executableSha256, helper: 'b'.repeat(64), launcher: 'c'.repeat(64) },
        environment: {}, replyTimeoutMs: 1000 } } }
  const policy = { gitExecutable, gitSha256, snapshotParent: parent, gitTimeoutMs: 10000,
    maxFiles: 10, maxFileBytes: 8192, maxTotalBytes: 32768 }
  return { base, repository, parent, git, input, policy, disposers }
}
async function make(f) {
  const result = await preparePlannerInputSnapshot(f.input, f.policy)
  f.disposers.push(result.dispose)
  return result
}

test('copies only committed admitted bytes, not dirty, staged, untracked files or Git metadata', async t => {
  const f = fixture(t)
  writeFileSync(join(f.repository, 'docs/input.txt'), 'staged replacement')
  f.git(['add', '--', 'docs/input.txt'])
  writeFileSync(join(f.repository, 'docs/input.txt'), 'working replacement')
  writeFileSync(join(f.repository, '.env'), 'UNRELATED-SYNTHETIC-SENTINEL')
  const before = f.git(['status', '--porcelain']).toString()
  const result = await make(f)
  assert.deepEqual(readFileSync(join(result.workspace, 'docs/input.txt')), data)
  assert.deepEqual(readdirSync(result.workspace), ['docs'])
  assert.equal(existsSync(join(result.workspace, '.git')), false)
  assert.equal(f.git(['status', '--porcelain']).toString(), before)
  assert.equal(result.executionAuthorized, false)
  assert.equal(result.productAccepted, false)
  assert.equal(result.projection.workingDirectory, result.workspace)
  assert.equal(result.projection.args[result.projection.args.indexOf('--cd') + 1], result.workspace)
  assert.equal(f.input.run.input.workspace, f.repository)
  assert.equal(result.prepared.run.input.workspaceKind, 'fixed-input-snapshot')
  assert.equal(result.projection.args.includes('--skip-git-repo-check'), true)
  assert.equal(result.projection.args[result.projection.args.indexOf('--sandbox') + 1], 'read-only')
  assert.match(result.projection.configToml, /approval_policy = "never"/)
  assert.deepEqual(result.prepared.readSet, f.input.readSet)
  await result.verify()
})

test('snapshot stays independent after source checkout changes and uses no hardlinks', async t => {
  const f = fixture(t), result = await make(f)
  writeFileSync(join(f.repository, 'docs/input.txt'), 'changed after export')
  assert.deepEqual(readFileSync(join(result.workspace, 'docs/input.txt')), data)
  assert.equal(statSync(join(result.workspace, 'docs/input.txt')).nlink, 1)
  await result.verify()
})

test('concurrent preparations own distinct roots and cleanup leaves the other intact', async t => {
  const f = fixture(t)
  const [one, two] = await Promise.all([make(f), make(f)])
  assert.notEqual(one.directory, two.directory)
  await one.dispose(); await two.verify()
  assert.equal(existsSync(one.directory), false)
})

for (const path of ['../outside', '/absolute', 'C:/outside', 'a\\b', 'a:stream', '.git/config',
  'a/../b', 'NUL.txt', 'a/LPT1.log', 'trailing. ', 'a//b', 'e\u0301.txt', 'a\nb']) {
  test(`rejects nonportable or escaping read-set path ${JSON.stringify(path)}`, async t => {
    const f = fixture(t); f.input.readSet[0].path = path
    await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code('SNAPSHOT_READ_SET_INVALID'))
    assert.deepEqual(readdirSync(f.parent), [])
  })
}

test('rejects case aliases and file/directory prefix collisions before export', async t => {
  const f = fixture(t)
  for (const paths of [['docs/input.txt', 'DOCS/INPUT.TXT'], ['docs', 'docs/input.txt'], ['Docs/a', 'docs/b']]) {
    f.input.readSet = paths.map(path => ({ path, sha256: hash(data) }))
    await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code('SNAPSHOT_READ_SET_INVALID'))
  }
})

for (const [name, mutate, expected] of [
  ['wrong digest', f => { f.input.readSet[0].sha256 = '0'.repeat(64) }, 'SNAPSHOT_CONTENT_MISMATCH'],
  ['missing file', f => { f.input.readSet[0].path = 'missing.txt' }, 'SNAPSHOT_ENTRY_INVALID'],
  ['per-file cap', f => { f.policy.maxFileBytes = data.length - 1 }, 'SNAPSHOT_SIZE_EXCEEDED'],
  ['total cap', f => { f.policy.maxTotalBytes = data.length - 1 }, 'SNAPSHOT_SIZE_EXCEEDED'],
  ['wrong Git digest', f => { f.policy.gitSha256 = '0'.repeat(64) }, 'SNAPSHOT_GIT_IDENTITY_INVALID'],
  ['branch instead of commit', f => { f.input.sourceCommit = 'HEAD' }, 'SNAPSHOT_REQUEST_INVALID'],
  ['tree instead of commit', f => { f.input.sourceCommit = f.git(['rev-parse', 'HEAD^{tree}']).toString().trim() }, 'SNAPSHOT_COMMIT_INVALID'],
]) test(`${name} fails without allocating an input directory`, async t => {
  const f = fixture(t); mutate(f)
  await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code(expected))
  assert.deepEqual(readdirSync(f.parent), [])
})

for (const mode of ['120000', '160000']) test(`does not materialize Git mode ${mode} as an ordinary file`, async t => {
  const f = fixture(t)
  const oid = mode === '160000' ? f.input.sourceCommit : f.git(['hash-object', '-w', '--stdin'], 'docs/input.txt').toString().trim()
  f.git(['update-index', '--add', '--cacheinfo', `${mode},${oid},linked`]); f.git(['commit', '-qm', 'special entry'])
  f.input.sourceCommit = f.git(['rev-parse', 'HEAD']).toString().trim()
  f.input.readSet = [{ path: 'linked', sha256: hash('docs/input.txt') }]
  await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code('SNAPSHOT_ENTRY_INVALID'))
})

test('ignores replacement refs and ambient GIT_DIR without changing either', async t => {
  const f = fixture(t)
  const original = f.git(['rev-parse', 'HEAD:docs/input.txt']).toString().trim()
  const other = f.git(['hash-object', '-w', '--stdin'], 'replacement bytes').toString().trim()
  f.git(['replace', original, other])
  assert.equal(f.git(['cat-file', 'blob', original]).toString(), 'replacement bytes')
  const old = process.env.GIT_DIR; process.env.GIT_DIR = join(f.base, 'nonexistent')
  try {
    const result = await make(f)
    assert.deepEqual(readFileSync(join(result.workspace, 'docs/input.txt')), data)
  } finally { if (old === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = old }
  assert.equal(f.git(['cat-file', 'blob', original]).toString(), 'replacement bytes')
})

for (const change of ['extra-file', 'missing-file', 'modified-file', 'extra-directory', 'manifest']) {
  test(`verify rejects ${change} rather than signing an altered snapshot`, async t => {
    const f = fixture(t), result = await make(f)
    const target = join(result.workspace, 'docs/input.txt')
    if (change === 'extra-file') writeFileSync(join(result.workspace, 'extra.txt'), 'extra')
    if (change === 'extra-directory') mkdirSync(join(result.workspace, 'empty'))
    if (change === 'missing-file') { chmodSync(target, 0o600); unlinkSync(target) }
    if (change === 'modified-file') { chmodSync(target, 0o600); writeFileSync(target, 'x'.repeat(data.length)) }
    if (change === 'manifest') {
      const manifest = join(result.directory, 'manifest.json'); chmodSync(manifest, 0o600); writeFileSync(manifest, '{}')
    }
    await assert.rejects(result.verify(), code('SNAPSHOT_CONTENT_MISMATCH'))
  })
}

test('snapshot-parent junction/symlink is refused without touching its target', async t => {
  const f = fixture(t), alias = join(f.base, 'parent-link')
  symlinkSync(f.parent, alias, process.platform === 'win32' ? 'junction' : 'dir')
  try {
    f.policy.snapshotParent = alias
    await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code('SNAPSHOT_LOCATION_INVALID'))
    assert.deepEqual(readdirSync(f.parent), [])
  } finally { unlinkSync(alias) }
})

test('replaced snapshot root is not followed or recursively deleted', async t => {
  const f = fixture(t), result = await make(f)
  const moved = result.directory + '-saved'
  renameSync(result.directory, moved)
  symlinkSync(f.repository, result.directory, process.platform === 'win32' ? 'junction' : 'dir')
  try {
    await assert.rejects(result.verify(), code('SNAPSHOT_IDENTITY_CHANGED'))
    await assert.rejects(result.dispose(), code('SNAPSHOT_CLEANUP_BLOCKED'))
    assert.deepEqual(readFileSync(join(f.repository, 'docs/input.txt')), data)
  } finally { unlinkSync(result.directory); renameSync(moved, result.directory) }
})

test('HTTP is still refused without changing the real protected model files', async t => {
  const f = fixture(t)
  f.input.run.configuration = config; f.input.run.trustedLock = lock
  await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), /CODEX_LAUNCH_PROJECTION_REFUSED/)
  assert.deepEqual(readdirSync(f.parent), [])
})


test('empty and binary committed files retain their exact bytes', async t => {
  const f = fixture(t)
  const binary = Buffer.from([0, 255, 13, 10, 128])
  writeFileSync(join(f.repository, 'empty'), '')
  writeFileSync(join(f.repository, 'data.bin'), binary)
  f.git(['add', '--', 'empty', 'data.bin']); f.git(['commit', '-qm', 'raw bytes'])
  f.input.sourceCommit = f.git(['rev-parse', 'HEAD']).toString().trim()
  f.input.readSet = [{ path: 'empty', sha256: hash('') }, { path: 'data.bin', sha256: hash(binary) }]
  const result = await make(f)
  assert.deepEqual(readFileSync(join(result.workspace, 'data.bin')), binary)
  assert.equal(statSync(join(result.workspace, 'empty')).size, 0)
  await result.verify()
})

test('literal brackets in an admitted path do not select sibling files', async t => {
  const f = fixture(t)
  writeFileSync(join(f.repository, '[one].txt'), 'selected')
  writeFileSync(join(f.repository, 'o.txt'), 'not selected')
  f.git(['add', '--', '.']); f.git(['commit', '-qm', 'literal names'])
  f.input.sourceCommit = f.git(['rev-parse', 'HEAD']).toString().trim()
  f.input.readSet = [{ path: '[one].txt', sha256: hash('selected') }]
  const result = await make(f)
  assert.deepEqual(readdirSync(result.workspace), ['[one].txt'])
})

test('configuration filters are not applied to raw committed files', async t => {
  const f = fixture(t)
  writeFileSync(join(f.repository, '.gitattributes'), 'docs/input.txt filter=snapshot-deny\n')
  f.git(['add', '--', '.gitattributes']); f.git(['commit', '-qm', 'attributes'])
  f.git(['config', 'filter.snapshot-deny.smudge', 'this-command-must-not-run'])
  f.git(['config', 'filter.snapshot-deny.required', 'true'])
  f.input.sourceCommit = f.git(['rev-parse', 'HEAD']).toString().trim()
  const result = await make(f)
  assert.deepEqual(readFileSync(join(result.workspace, 'docs/input.txt')), data)
})

test('file-count limit rejects before creating a snapshot', async t => {
  const f = fixture(t); f.policy.maxFiles = 1
  f.input.readSet.push({ path: 'not-selected.txt', sha256: hash('not in read set') })
  await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code('SNAPSHOT_READ_SET_INVALID'))
  assert.deepEqual(readdirSync(f.parent), [])
})

test('unknown policy fields do not silently widen preparation', async t => {
  const f = fixture(t); f.policy.allowNetwork = true
  await assert.rejects(preparePlannerInputSnapshot(f.input, f.policy), code('SNAPSHOT_POLICY_INVALID'))
})

test('caller mutations during Git work cannot change the private read-set copy', async t => {
  const f = fixture(t)
  const pending = preparePlannerInputSnapshot(f.input, f.policy)
  f.input.readSet[0].path = 'not-selected.txt'; f.policy.maxFileBytes = 1
  const result = await pending; f.disposers.push(result.dispose)
  assert.deepEqual(readFileSync(join(result.workspace, 'docs/input.txt')), data)
  assert.equal(existsSync(join(result.workspace, 'not-selected.txt')), false)
})

test('inner directory link is rejected and cleanup unlinks only that link', async t => {
  const f = fixture(t), result = await make(f)
  const inner = join(result.workspace, 'docs')
  chmodSync(join(inner, 'input.txt'), 0o600); unlinkSync(join(inner, 'input.txt')); rmSync(inner, { recursive: true })
  symlinkSync(join(f.repository, 'docs'), inner, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(result.verify(), code('SNAPSHOT_CONTENT_MISMATCH'))
  await result.dispose()
  assert.deepEqual(readFileSync(join(f.repository, 'docs/input.txt')), data)
})


test('concurrent cleanup of the same allocation is joined and verification then refuses it', async t => {
  const f = fixture(t), result = await make(f)
  await Promise.all([result.dispose(), result.dispose()])
  assert.equal(existsSync(result.directory), false)
  await assert.rejects(result.verify(), code('SNAPSHOT_DISPOSED'))
})
