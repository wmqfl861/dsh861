import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { prepareCodexSandboxQualification } from './codex-sandbox-qualification.mjs'
import { createProcessJobOwner } from './windows-job-owner.ts'
import { resolveProjectCodexTools } from './codex-installed-tools.mjs'

const directory = fileURLToPath(new URL('.', import.meta.url))
const repository = fileURLToPath(new URL('../../../', import.meta.url))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const fileHash = path => sha256(readFileSync(path))
// Failure evidence keeps the native error text itself, not only a digest: printable characters only, byte-bounded.
const sanitizedExcerpt = (text, limit = 4096) => {
  const printable = text.replace(/[^\t\n\r\x20-\x7e]/g, '')
  return Buffer.byteLength(printable) <= limit ? printable
    : printable.slice(0, limit) + `…[truncated ${Buffer.byteLength(printable) - limit} bytes]`
}

async function runOwned(probe, temporary, diagnostic, lifecycle, codexPath) {
  lifecycle.cleanupObserved = false
  const powershell = join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
  const owner = await createProcessJobOwner({ powershellExecutable: powershell, directory,
    sha256: { executable: fileHash(powershell), helper: fileHash(join(directory, 'job-owner.ps1')),
      launcher: fileHash(join(directory, 'launch-gate.mjs')) },
    environment: { SystemRoot: process.env.SystemRoot, TEMP: temporary, TMP: temporary }, replyTimeoutMs: 15000 })
  let result
  let terminated = false, active = -1, disposed = false
  try {
    const child = owner.launchGated({ executable: codexPath, args: probe.sandboxArgs,
      workingDirectory: probe.workspace, environment: probe.environment, maxWaitMs: 15000 })
    let timedOut = false, outputBoundExceeded = false, controlFailed = false, timer, graceTimer
    let stdout = '', stderr = '', channelBytes = 0
    const stop = () => {
      try { owner.abortGated() } catch { controlFailed = true }
      void owner.terminateOwned().catch(() => { controlFailed = true })
    }
    const finished = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true; stop()
        graceTimer = setTimeout(() => { reject(new Error('SANDBOX_NATIVE_CLOSE_UNOBSERVED')) }, 5000)
      }, 45000)
      for (const [stream, target] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
        stream.on('data', bytes => {
          channelBytes += bytes.length
          if (channelBytes > 65536) { outputBoundExceeded = true; stop(); return }
          if (target === 'stdout') stdout += bytes.toString('utf8')
          else stderr += bytes.toString('utf8')
        })
        stream.on('error', stop)
      }
      child.on('error', stop)
      child.once('close', (exitCode, signal) => { resolve({ exitCode, signal, stdout, timedOut, error: outputBoundExceeded || controlFailed }) })
    })
    // Ensure any late timeout rejection is observed even if assignment fails first.
    finished.catch(() => {})
    try {
      assert.equal(await owner.assign(child.pid), true, 'SANDBOX_NATIVE_GATE_ASSIGNMENT_FAILED')
      owner.releaseGated()
      child.stdin.end()
      result = await finished
    } finally { clearTimeout(timer); clearTimeout(graceTimer) }
    diagnostic({ exitCode: result.exitCode, signal: result.signal, timedOut,
      outputBoundExceeded, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr),
      stderrSha256: sha256(stderr), stderrText: sanitizedExcerpt(stderr), stdoutText: sanitizedExcerpt(stdout) })
  } finally {
    try { terminated = await owner.terminateOwned() } catch { /* false is not successful cleanup */ }
    try { active = await owner.activeProcesses() } catch { /* -1 is unknown, not empty */ }
    try { await owner.dispose(); disposed = true } catch { /* false is retained for the cleanup assertion */ }
    lifecycle.cleanupObserved = terminated && active === 0 && disposed
    assert.deepEqual({ terminated, active, disposed }, { terminated: true, active: 0, disposed: true },
      'SANDBOX_NATIVE_CLEANUP_BLOCKED')
  }
  return result
}

test('pinned Codex native sandbox denies outside reads and writes for a real child after a positive control',
  { skip: process.platform !== 'win32', timeout: 120000 }, async t => {
    const owner = JSON.parse(readFileSync(join(repository, 'packages/subagent/subagent-codex/package.json'), 'utf8'))
    const version = owner.dependencies['@openai/codex']
    assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
    const manifest = JSON.parse(readFileSync(join(directory, `sandbox-tool-bundle.${version}.json`), 'utf8'))
    const tools = await resolveProjectCodexTools(repository, manifest)
    const codexHash = manifest.artifacts.find(pin => pin.role === 'codex').sha256
    const temporary = mkdtempSync(join(tmpdir(), 'dsh-codex-scope-'))
    let probe
    const lifecycle = { cleanupObserved: true }
    t.after(async () => {
      assert.equal(lifecycle.cleanupObserved, true, 'SANDBOX_NATIVE_RESIDUE_REQUIRES_REVIEW')
      if (probe) await probe.dispose()
      rmSync(temporary, { recursive: true, force: true })
    })
    probe = await prepareCodexSandboxQualification({ parent: temporary, nodeExecutable: process.execPath,
      nodeSha256: fileHash(process.execPath), systemRoot: process.env.SystemRoot })
    const baseline = spawnSync(probe.command[0], probe.command.slice(1), { cwd: probe.workspace, env: probe.environment,
      encoding: 'utf8', timeout: 15000, maxBuffer: 32768, windowsHide: true, shell: false })
    await probe.verifyBaseline({ exitCode: baseline.status, signal: baseline.signal,
      error: baseline.error, stdout: baseline.stdout })
    const result = await runOwned(probe, temporary, value => { t.diagnostic(JSON.stringify(value)) }, lifecycle, tools.sources.codex)
    // Unsupported setup/profile is a qualification blocker, not evidence that reads were denied.
    const receipt = await probe.verifyRestricted(result)
    assert.equal(receipt.status, 'SANDBOX_SCOPE_OBSERVED')
    assert.equal(receipt.productionIsolationAccepted, false)
    t.diagnostic(JSON.stringify({ ...receipt, codexSha256: codexHash, codexVersion: tools.version }))
  })
