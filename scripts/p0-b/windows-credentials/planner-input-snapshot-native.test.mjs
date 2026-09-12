import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { constants, createHash, createPublicKey, generateKeyPairSync, publicEncrypt, sign } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { devNull, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { publicConfigDigest } from '../model-config.mjs'
import { preparePlannerInputSnapshot } from './planner-input-snapshot.mjs'
import { createPlannerApprovalVerifier, plannerDecisionPayload, plannerDecisionSigningBytes } from './planner-approval.mjs'
import { createOwnerApprovedPlanner, describePlannerApprovalRequest } from './owner-approved-planner.ts'
import { createPlannerTlsVerifier } from './planner-tls.mjs'
import { loopbackTls } from './fixtures/planner-tls-server.mjs'

// Native Windows consumer, local Git and loopback TLS. No real signer, model, secrets or enforcement provider.
const directory = fileURLToPath(new URL('.', import.meta.url))
const repository = join(directory, '../../..')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const fileHash = file => hash(readFileSync(file))

test('a signed snapshot request reaches the existing native entry with committed rather than live inputs',
  { skip: process.platform !== 'win32', timeout: 120000 }, async t => {
    const peer = await loopbackTls(t)
    const base = mkdtempSync(join(tmpdir(), 'dsh-snapshot-native-'))
    let snapshot
    t.after(async () => {
      if (snapshot) await snapshot.dispose()
      rmSync(base, { recursive: true, force: true })
    })
    const source = join(base, 'source'), parent = join(base, 'snapshots'), spent = join(base, 'spent')
    for (const path of [source, parent, spent]) mkdirSync(path)
    const systemRoot = process.env.SystemRoot
    const gitExecutable = realpathSync(execFileSync('where.exe', ['git.exe'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0])
    const git = args => execFileSync(gitExecutable, ['-c', 'core.autocrlf=false', '-c', 'commit.gpgSign=false',
      '-c', 'core.hooksPath=' + join(base, 'no-hooks'), '-c', 'user.name=Snapshot Fixture',
      '-c', 'user.email=snapshot@example.invalid', '-C', source, ...args],
    { encoding: 'utf8', timeout: 10000, env: { SystemRoot: systemRoot, HOME: base, USERPROFILE: base, TEMP: base, TMP: base,
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull, GIT_TERMINAL_PROMPT: '0' } })
    git(['init', '-q'])
    writeFileSync(join(source, 'input.txt'), 'COMMITTED-INPUT')
    writeFileSync(join(source, 'exec'), [
      "const {readFileSync} = require('node:fs')",
      'process.stdin.resume()',
      "process.stdin.on('end', () => process.stdout.write(JSON.stringify({input:readFileSync('input.txt','utf8'),argv:process.argv.slice(2),cwd:process.cwd(),pid:process.pid,ppid:process.ppid})+'\\n'))",
    ].join('\n') + '\n')
    git(['add', '--', 'exec', 'input.txt']); git(['commit', '-qm', 'fixed native input'])
    const sourceCommit = git(['rev-parse', 'HEAD']).trim()
    const readSet = ['exec', 'input.txt'].map(path => ({ path, sha256: fileHash(join(source, path)) }))
    writeFileSync(join(source, 'input.txt'), 'DIRTY-MUST-NOT-BE-READ')
    writeFileSync(join(source, 'private.txt'), 'UNLISTED-SYNTHETIC-SENTINEL')
    const configuration = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.json'), 'utf8'))
    const trustedLock = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.lock.json'), 'utf8'))
    configuration.agents.codex.baseUrl = peer.baseUrl
    const prompt = join(base, 'prompt.txt'); writeFileSync(prompt, 'synthetic prompt')
    const powershell = join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
    const request = { sourceCommit, readSet, run: {
      configuration, trustedLock: { ...trustedLock, publicConfigSha256: publicConfigDigest(configuration) },
      input: { platform: 'win32', workspace: source, runRoot: join(base, 'run'), executable: process.execPath,
        executableSha256: fileHash(process.execPath), systemRoot, toolDirectories: [dirname(process.execPath)] },
      prompt: { file: prompt, sha256: fileHash(prompt) },
      bounds: { deadlineMs: 10000, terminationGraceMs: 500, maxChannelBytes: 8192,
        redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 } },
      jobOwner: { powershellExecutable: powershell, directory, sha256: { executable: fileHash(powershell),
        helper: fileHash(join(directory, 'job-owner.ps1')), launcher: fileHash(join(directory, 'launch-gate.mjs')) },
      environment: { SystemRoot: systemRoot, TEMP: base, TMP: base }, replyTimeoutMs: 20000 },
    } }
    const oldDigest = describePlannerApprovalRequest(request).requestSha256
    snapshot = await preparePlannerInputSnapshot(request, { gitExecutable, gitSha256: fileHash(gitExecutable),
      snapshotParent: parent, gitTimeoutMs: 10000, maxFiles: 10, maxFileBytes: 8192, maxTotalBytes: 32768 })
    const { requestSha256 } = describePlannerApprovalRequest(snapshot.prepared)
    assert.notEqual(oldDigest, requestSha256, 'the source-workspace approval must not silently approve a snapshot path')
    const keys = generateKeyPairSync('ed25519'), now = Date.now()
    const claims = { version: 1, purpose: 'P0-B-CODEX-PLAN', ownerId: 'snapshot-test-owner', approvalId: 'snapshot-attempt',
      requestSha256, approved: true, maxAttempts: 1, notBefore: now - 1000, expiresAt: now + 120000,
      rotationConfirmed: true, rotationRecord: 'test/rotation', transportRecord: 'test/tls',
      budget: { currency: 'USD', limitMinorUnits: 1, enforcementRecord: 'test/synthetic-budget' } }
    const payload = plannerDecisionPayload(claims)
    const decision = { payload, signature: sign(null, plannerDecisionSigningBytes(payload), keys.privateKey).toString('base64url') }
    let reads = 0, closed = 0
    const invoke = createOwnerApprovedPlanner({
      approvals: createPlannerApprovalVerifier({ ownerId: claims.ownerId, spentDirectory: spent, maxValidityMs: 180000,
        publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }) }),
      transport: createPlannerTlsVerifier(peer.policy),
      bridge: async (_action, _provider, bytes) => {
        reads++
        const query = JSON.parse(bytes.toString('utf8'))
        const key = createPublicKey({ format: 'jwk', key: { kty: 'RSA',
          n: Buffer.from(query.modulus, 'base64').toString('base64url'), e: Buffer.from(query.exponent, 'base64').toString('base64url') } })
        const ciphertext = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
          Buffer.from('SYNTHETIC-SNAPSHOT-CREDENTIAL')).toString('base64')
        return Buffer.from(JSON.stringify({ version: 1, requestId: query.requestId, status: 'SEALED', ciphertext, selfTestRemoved: false }))
      },
      acquireControls: async (approved, digest) => ({ requestSha256: digest, approvalId: approved.approvalId,
        transportRecord: approved.transportRecord, rotationRecord: approved.rotationRecord, budget: approved.budget,
        isolationRecord: 'test/synthetic-controls-not-os-isolation', assertActive: () => snapshot.verify(),
        close: async () => { closed++ } }),
    })
    const result = await invoke(snapshot.prepared, decision)
    assert.equal(result.status, 'OWNER_APPROVED_PLANNER_ATTEMPTED')
    assert.equal(result.result.status, 'PROJECTED_PLANNER_COMPLETED')
    assert.equal(result.result.invocation.exitCode, 0)
    assert.equal(result.result.ownership.activeProcessesRemaining, 0)
    assert.equal(result.result.ownership.disposed, true)
    const observed = JSON.parse(result.result.invocation.redactedStdout.trim())
    assert.equal(observed.input, 'COMMITTED-INPUT')
    assert.equal(realpathSync(observed.cwd), realpathSync(snapshot.workspace))
    assert.equal(observed.argv.includes('--skip-git-repo-check'), true)
    assert.equal(observed.argv[observed.argv.indexOf('--sandbox') + 1], 'read-only')
    assert.equal(existsSync(join(snapshot.workspace, 'private.txt')), false)
    assert.deepEqual(readdirSync(snapshot.workspace).sort(), ['exec', 'input.txt'])
    await snapshot.verify()
    assert.equal(reads, 1); assert.equal(closed, 1)
    assert.equal((await invoke(snapshot.prepared, decision)).code, 'PLANNER_APPROVAL_USED')
    assert.equal(reads, 1)
  })
