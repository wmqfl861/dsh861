import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { constants, createHash, createPublicKey, publicEncrypt } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { publicConfigDigest } from '../model-config.mjs'
import { invokeProjectedPlannerOnce } from './planner-entry.ts'
import { invokePlannerOnce } from './planner-invocation.ts'
import { createProcessJobOwner } from './windows-job-owner.ts'

// Real Windows PowerShell helper and real synthetic processes validate the
// projected entry's ownership wiring. The CLI stand-in is an extensionless
// CommonJS file named `exec` in the workspace: Node resolves the projected
// argv[0] against the spawn cwd, so the CLI receives the projection's argv
// verbatim with no test hook in the entry. No credential store, no endpoint.
const directory = fileURLToPath(new URL('.', import.meta.url))
const repository = join(directory, '../../..')
const powershellExecutable = join(process.env.SystemRoot ?? '', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const realConfiguration = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.json'), 'utf8'))
const realLock = JSON.parse(readFileSync(join(repository, 'config/agents/models.v1.lock.json'), 'utf8'))
const leasedValue = 'SYNTHETIC-ENTRY-KEY-c31d77'

function syntheticConfiguration() {
  const configuration = structuredClone(realConfiguration)
  configuration.agents.codex.baseUrl = 'https://approved.example.invalid/v1'
  return { configuration, trustedLock: { ...structuredClone(realLock), publicConfigSha256: publicConfigDigest(configuration) } }
}

function sealedPacket(request, value) {
  const key = createPublicKey({ format: 'jwk', key: { kty: 'RSA',
    n: Buffer.from(request.modulus, 'base64').toString('base64url'),
    e: Buffer.from(request.exponent, 'base64').toString('base64url') } })
  const ciphertext = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(value)).toString('base64')
  return Buffer.from(JSON.stringify({ version: 1, requestId: request.requestId, status: 'SEALED',
    ciphertext, selfTestRemoved: false }))
}

function fakeBridge() {
  const observation = { reads: 0 }
  const invoke = async (action, provider, requestBytes) => {
    observation.reads++
    return sealedPacket(JSON.parse(requestBytes.toString()), leasedValue)
  }
  return { observation, invoke }
}

/** Descendant writer with a beat file, pid file and advancing timestamps. */
function writeWriterScript(base, name) {
  const file = join(base, `${name}.mjs`)
  const beatLog = join(base, `${name}.log`)
  const beatN = join(base, `${name}.n`)
  const pidFile = join(base, `${name}.pid`)
  writeFileSync(file, [
    "import { writeFileSync } from 'node:fs'",
    `writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))`,
    `writeFileSync(${JSON.stringify(beatLog)}, 'start')`,
    `setInterval(() => writeFileSync(${JSON.stringify(beatN)}, String(Date.now())), 120)`,
    'setTimeout(() => process.exit(0), 120000)',
  ].join('\n'))
  return { file, name }
}

/** PowerShell member that tries to escape via CREATE_BREAKAWAY_FROM_JOB and
 * records the kernel-filled identity of the exact process it created. */
function writeBreakawayAttempt(directory_) {
  const file = join(directory_, 'breakaway-attempt.ps1')
  writeFileSync(file, [
    '$ErrorActionPreference = \'Stop\'',
    '$src = @"',
    'using System; using System.Runtime.InteropServices;',
    'public static class K {',
    '  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct SI { public uint cb; public IntPtr lpReserved; public IntPtr lpDesktop; public IntPtr lpTitle; public uint dwX; public uint dwY; public uint dwXSize; public uint dwYSize; public uint dwXCountChars; public uint dwYCountChars; public uint dwFillAttribute; public uint dwFlags; public short wShowWindow; public short cbReserved2; public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError; }',
    '  [StructLayout(LayoutKind.Sequential)] public struct PI { public IntPtr hP; public IntPtr hT; public uint dwProcessId; public uint dwThreadId; }',
    '  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool CreateProcessW(string app, string cmd, IntPtr pa, IntPtr ta, bool inh, uint fl, IntPtr env, string cwd, ref SI si, ref PI pi);',
    '  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);',
    '}',
    '"@',
    'Add-Type -TypeDefinition $src',
    '$si = New-Object K+SI; $si.cb = [Runtime.InteropServices.Marshal]::SizeOf($si)',
    '$pi = New-Object K+PI',
    // The ABI is verified, not assumed: PROCESS_INFORMATION is two pointers
    // followed by the dwProcessId and dwThreadId DWORDs the kernel fills.
    '$handleBytes = [IntPtr]::Size * 2',
    '$piSize = [Runtime.InteropServices.Marshal]::SizeOf($pi)',
    "$offPid = [Runtime.InteropServices.Marshal]::OffsetOf([K+PI], 'dwProcessId').ToInt64()",
    "$offTid = [Runtime.InteropServices.Marshal]::OffsetOf([K+PI], 'dwThreadId').ToInt64()",
    '[IO.File]::WriteAllText("pi-layout", "size=$piSize;pid@$offPid;tid@$offTid")',
    'if ($piSize -ne ($handleBytes + 8) -or $offPid -ne $handleBytes -or $offTid -ne ($handleBytes + 4)) { exit 6 }',
    '[IO.File]::WriteAllText("escape-writer.cmd", "@echo off`r`necho start > escape.log`r`n:loop`r`necho %TIME% >> escape.log`r`nping -n 1 -w 300 127.0.0.1 > nul`r`ngoto loop")',
    '$ok = [K]::CreateProcessW("$env:SystemRoot\\System32\\cmd.exe", \'"%SystemRoot%\\System32\\cmd.exe" /c escape-writer.cmd\', [IntPtr]::Zero, [IntPtr]::Zero, $false, 0x01000000, [IntPtr]::Zero, (Get-Location).Path, [ref]$si, [ref]$pi)',
    'if (-not $ok) { [IO.File]::WriteAllText("escape-refused", [Runtime.InteropServices.Marshal]::GetLastWin32Error().ToString()); exit 5 }',
    'if ($pi.dwProcessId -le 0 -or $pi.dwThreadId -le 0) { [K]::CloseHandle($pi.hP) | Out-Null; [K]::CloseHandle($pi.hT) | Out-Null; [IO.File]::WriteAllText("pi-fields-invalid", "pid=$($pi.dwProcessId);tid=$($pi.dwThreadId)"); exit 7 }',
    // The verified layout yields the real kernel identity; a cmd-side %PID%
    // echo is an undefined cmd variable and was only a placeholder.
    '[IO.File]::WriteAllText("escape-real.pid", [string]$pi.dwProcessId)',
    '[IO.File]::WriteAllText("escape-real.tid", [string]$pi.dwThreadId)',
    // Keep the waitable process handle until this member dies: it pins the
    // kernel object so the PID cannot be reused while the outside observer
    // resolves it. The thread handle is not a death handle and is released.
    '[K]::CloseHandle($pi.hT) | Out-Null',
    'Set-Content -Path escape-holder.pid -Value $PID',
    'while ($true) { Start-Sleep -Milliseconds 250 }',
  ].join('\n'))
  return file
}

/** Outside-the-job observer for the breakaway attempt: a direct child of this
 * test, so it survives the owned job's teardown. It resolves the kernel-filled
 * dwProcessId to its own SYNCHRONIZE handle and records the wait verdict for
 * that exact process. Only WAIT_OBJECT_0 with a readable exit code is a kernel
 * exit; open failure, WAIT_FAILED, WAIT_TIMEOUT, a missing or unparsable PID
 * and a refused creation stay distinct modes and never count as death. */
function writeEscapeObserver(base) {
  const file = join(base, 'escape-observer.ps1')
  writeFileSync(file, [
    'param([string]$WatchPidFile, [string]$RefusedFile, [string]$OutFile, [int]$PollMs, [int]$WaitMs)',
    "$ErrorActionPreference = 'Stop'",
    '$src = @"',
    'using System; using System.Runtime.InteropServices;',
    'public static class O {',
    '  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);',
    '  [DllImport("kernel32.dll", SetLastError=true)] public static extern uint WaitForSingleObject(IntPtr h, uint ms);',
    '  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetExitCodeProcess(IntPtr h, out uint code);',
    '  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);',
    '}',
    '"@',
    'Add-Type -TypeDefinition $src',
    'function Save([string]$text) { [IO.File]::WriteAllText($OutFile, $text); exit 0 }',
    '$started = [Environment]::TickCount64',
    '$deadline = $started + $PollMs',
    '$pidText = $null',
    'while ([Environment]::TickCount64 -lt $deadline) {',
    '  if (Test-Path -LiteralPath $RefusedFile) { Save(\'{"mode":"creation-refused"}\') }',
    '  if (Test-Path -LiteralPath $WatchPidFile) { $pidText = [IO.File]::ReadAllText($WatchPidFile).Trim(); break }',
    '  Start-Sleep -Milliseconds 20',
    '}',
    '$seenAfterMs = [Environment]::TickCount64 - $started',
    'if ($null -eq $pidText) { Save(\'{"mode":"pid-file-missing"}\') }',
    '$childPid = [uint32]0',
    'if (-not [uint32]::TryParse($pidText, [ref]$childPid) -or $childPid -eq 0) { Save(\'{"mode":"pid-invalid"}\') }',
    '# SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION',
    '$h = [O]::OpenProcess(0x00101000, $false, $childPid)',
    'if ($h -eq [IntPtr]::Zero) { Save((\'{{"mode":"open-failed","pid":{0},"error":{1},"seenAfterMs":{2}}}\' -f $childPid, [Runtime.InteropServices.Marshal]::GetLastWin32Error(), $seenAfterMs)) }',
    '$aliveCode = [uint32]0',
    '$aliveAtOpen = [O]::GetExitCodeProcess($h, [ref]$aliveCode) -and $aliveCode -eq 259',
    '$aliveText = if ($aliveAtOpen) { \'true\' } else { \'false\' }',
    'try {',
    '  $waitStart = [Environment]::TickCount64',
    '  $r = [O]::WaitForSingleObject($h, [uint32]$WaitMs)',
    '  $elapsed = [Environment]::TickCount64 - $waitStart',
    '  if ($r -eq 0) {',
    '    $code = [uint32]0',
    '    if (-not [O]::GetExitCodeProcess($h, [ref]$code)) { Save((\'{{"mode":"exit-code-failed","pid":{0}}}\' -f $childPid)) }',
    '    Save((\'{{"mode":"kernel-exit","pid":{0},"exitCode":{1},"waitMsElapsed":{2},"aliveAtOpen":{3},"seenAfterMs":{4}}}\' -f $childPid, $code, $elapsed, $aliveText, $seenAfterMs))',
    '  } elseif ($r -eq 258) {',
    '    Save((\'{{"mode":"wait-timeout","pid":{0}}}\' -f $childPid))',
    '  } else {',
    '    Save((\'{{"mode":"wait-failed","pid":{0},"error":{1}}}\' -f $childPid, [Runtime.InteropServices.Marshal]::GetLastWin32Error()))',
    '  }',
    '} finally { [O]::CloseHandle($h) | Out-Null }',
  ].join('\n'))
  return file
}

/**
 * Fresh deployment: separate workspace (holding the `exec` CLI stand-in) and
 * runRoot, fixed prompt file, integrity-checked job-owner deployment spec.
 */
function deployment(t, cliOptions = {}) {
  const base = mkdtempSync(join(tmpdir(), 'dsh861-planner-entry-'))
  const workspace = join(base, 'workspace')
  const runRoot = join(base, 'run')
  mkdirSync(workspace, { recursive: true })
  const promptFile = join(base, 'prompt.txt')
  writeFileSync(promptFile, 'fixed synthetic planning input\n')
  const lines = [
    "const { spawn } = require('node:child_process')",
    "const { writeFileSync } = require('node:fs')",
    "const projected = process.argv.slice(2)",
    "writeFileSync('argv-received.json', JSON.stringify(projected))",
    "writeFileSync('env-received.json', JSON.stringify({ CODEX_HOME: process.env.CODEX_HOME, USERPROFILE: process.env.USERPROFILE }))",
    "let received = 0",
    "process.stdin.on('data', chunk => { received += chunk.length })",
    "process.stdin.on('end', () => writeFileSync('prompt-bytes', String(received)))",
  ]
  if (cliOptions.writer) {
    lines.push(
      `const writer = spawn(process.execPath, [${JSON.stringify(cliOptions.writer)}], { detached: true, stdio: 'ignore' })`,
      'writer.unref()',
    )
  }
  if (cliOptions.breakaway) {
    lines.push(
      `const attempt = spawn(${JSON.stringify(powershellExecutable)}, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', ${JSON.stringify(cliOptions.breakaway)}], { stdio: 'ignore' })`,
      "attempt.on('error', () => writeFileSync('breakaway-spawn-error', ''))",
    )
  }
  lines.push(
    'process.stdin.resume()',
    `process.stdout.write('leased echo: ' + process.env.DSH861_CODEX_API_KEY + '\\n')`,
    cliOptions.stall === false
      ? "process.stdin.on('end', () => setTimeout(() => process.exit(0), 200))"
      : "setInterval(() => {}, 1000)",
  )
  writeFileSync(join(workspace, 'exec'), lines.join('\n'))
  const { configuration, trustedLock } = syntheticConfiguration()
  const spec = {
    configuration, trustedLock,
    input: {
      platform: 'win32', workspace, runRoot, executable: process.execPath,
      executableSha256: hash(process.execPath), systemRoot: process.env.SystemRoot ?? 'C:\\Windows',
      toolDirectories: [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')],
    },
    approval: { record: 'synthetic-owner-record', transportEvidenceRecord: 'synthetic-transport-record',
      subject: { agent: 'codex', model: 'gpt-6-astra', reasoningEffort: 'max',
        baseUrl: 'https://approved.example.invalid/v1' } },
    prompt: { file: promptFile, sha256: hash(promptFile) },
    bounds: { deadlineMs: cliOptions.deadlineMs ?? 1500, terminationGraceMs: 300, maxChannelBytes: 65536,
      redactionLimits: { maxSecrets: 2, maxSecretBytes: 384 } },
    jobOwner: {
      powershellExecutable, directory,
      sha256: { executable: hash(powershellExecutable), helper: hash(join(directory, 'job-owner.ps1')),
        launcher: hash(join(directory, 'launch-gate.mjs')) },
      environment: { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', TEMP: base, TMP: base },
      replyTimeoutMs: 20000,
    },
  }
  t.after(() => { rmSync(base, { recursive: true, force: true }) })
  return { base, workspace, runRoot, spec }
}

/** Frozen is termination evidence only for a heartbeat that existed and advanced before. */
async function heartbeatFrozen(base, name, waitMs = 2000) {
  const beatLog = join(base, `${name}.log`)
  const beatN = join(base, `${name}.n`)
  assert.equal(existsSync(beatLog), true, `${name} heartbeat never existed; absence is not death`)
  const first = statSync(beatLog)
  const firstN = existsSync(beatN) ? readFileSync(beatN, 'utf8') : null
  const end = performance.now() + waitMs
  while (performance.now() < end) {
    await delay(250)
    if (existsSync(beatN) && readFileSync(beatN, 'utf8') !== firstN) return false
    if (existsSync(beatLog)) {
      const now = statSync(beatLog)
      if (now.mtimeMs > first.mtimeMs || now.size > first.size) return false
    }
  }
  return true
}

function pidDead(base, name) {
  const file = join(base, `${name}.pid`)
  if (!existsSync(file)) return true
  try { process.kill(Number(readFileSync(file, 'utf8').trim()), 0); return false } catch { return true }
}

test('refuses the repository HTTP configuration before materializing anything', { skip: process.platform !== 'win32' }, async t => {
  const { runRoot, spec } = deployment(t)
  spec.configuration = realConfiguration
  spec.trustedLock = realLock
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(result.code, 'CODEX_LAUNCH_PROJECTION_REFUSED')
  assert.equal(bridge.observation.reads, 0)
  assert.equal(existsSync(runRoot), false)
})

test('refuses an approval whose subject is not the projected route', { skip: process.platform !== 'win32' }, async t => {
  const { spec } = deployment(t)
  spec.approval.subject.model = 'not-the-approved-model'
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(result.code, 'PLANNER_SUBJECT_NOT_APPROVED')
  assert.equal(bridge.observation.reads, 0)
})

test('cancellation terminates the detached descendant through the owned job', { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
  const { base, workspace, spec } = deployment(t, { deadlineMs: 1500 })
  const writer = writeWriterScript(base, 'descendant')
  // Regenerate the workspace `exec` stand-in with the writer attached.
  writeFileSync(join(workspace, 'exec'), [
    "const { spawn } = require('node:child_process')",
    "const { writeFileSync } = require('node:fs')",
    "writeFileSync('argv-received.json', JSON.stringify(process.argv.slice(2)))",
    "writeFileSync('env-received.json', JSON.stringify({ CODEX_HOME: process.env.CODEX_HOME, USERPROFILE: process.env.USERPROFILE }))",
    // The fixed input arrives only after the wrapper's ownership assignment
    // settles, so the detached writer is created inside the owned scope.
    'process.stdin.resume()',
    "process.stdin.on('end', () => {",
    `  const writer = spawn(process.execPath, [${JSON.stringify(writer.file)}], { detached: true, stdio: 'ignore' })`,
    '  writer.unref()',
    "  process.stdout.write('leased echo: ' + process.env.DSH861_CODEX_API_KEY + '\\n')",
    '})',
    'setInterval(() => {}, 1000)',
  ].join('\n'))
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(bridge.observation.reads, 1)
  assert.equal(result.status, 'PROJECTED_PLANNER_CANCELLED')
  assert.equal(result.invocation.cancellationReason, 'DEADLINE_EXCEEDED')
  assert.equal(result.invocation.ownership.assignmentRequested, true)
  assert.equal(result.ownership.terminated, true)
  assert.equal(result.ownership.activeProcessesRemaining, 0)
  assert.equal(result.ownership.disposed, true)
  assert.equal(result.invocation.redactedStdout.includes(leasedValue), false)
  // Cancellation discards the redactors, so retained text may be an early safe
  // fragment; the detection latch is the required evidence, not a marker.
  assert.equal(result.invocation.secretLeakDetected, true)
  const argvReceived = JSON.parse(readFileSync(join(workspace, 'argv-received.json'), 'utf8'))
  assert.equal(argvReceived.at(-1), '-')
  assert.equal(argvReceived[argvReceived.indexOf('--sandbox') + 1], 'read-only')
  const envReceived = JSON.parse(readFileSync(join(workspace, 'env-received.json'), 'utf8'))
  assert.equal(envReceived.CODEX_HOME, join(spec.input.runRoot, 'codex-home'))
  assert.equal(existsSync(join(spec.input.runRoot, 'codex-home', 'config.toml')), true)
  assert.equal(await heartbeatFrozen(base, 'descendant'), true, 'detached descendant escaped the owned job')
  assert.equal(pidDead(base, 'descendant'), true)
  assert.equal(result.invocation.cleanup.descendantState, 'NOT_VERIFIED')
})

test('a module-top-level descendant, created before any stdin read, stays contained', { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
  const { base, workspace, spec } = deployment(t, { deadlineMs: 1500 })
  const writer = writeWriterScript(base, 'top-level-writer')
  writeFileSync(join(workspace, 'exec'), [
    "const { spawn } = require('node:child_process')",
    "const { writeFileSync } = require('node:fs')",
    // Module top level: the detached descendant exists before the first stdin
    // read and before any post-spawn assignment could have landed on this
    // process, so only containment established before the CLI's first code
    // runs can own it.
    `const early = spawn(process.execPath, [${JSON.stringify(writer.file)}], { detached: true, stdio: 'ignore' })`,
    'early.unref()',
    "writeFileSync('argv-received.json', JSON.stringify(process.argv.slice(2)))",
    "writeFileSync('env-received.json', JSON.stringify({ CODEX_HOME: process.env.CODEX_HOME }))",
    'process.stdin.resume()',
    "process.stdin.on('end', () => {",
    "  process.stdout.write('leased echo: ' + process.env.DSH861_CODEX_API_KEY + '\\n')",
    '})',
    'setInterval(() => {}, 1000)',
  ].join('\n'))
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(bridge.observation.reads, 1)
  assert.equal(result.status, 'PROJECTED_PLANNER_CANCELLED')
  assert.equal(result.invocation.cancellationReason, 'DEADLINE_EXCEEDED')
  assert.equal(result.ownership.terminated, true)
  assert.equal(result.ownership.activeProcessesRemaining, 0)
  assert.equal(result.ownership.disposed, true)
  // The target must actually have run: a fix that never starts the CLI would
  // make every containment assertion below vacuously true.
  assert.equal(existsSync(join(workspace, 'argv-received.json')), true, 'gated CLI never ran')
  assert.equal(await heartbeatFrozen(base, 'top-level-writer'), true, 'module-top-level descendant escaped the owned job')
  assert.equal(pidDead(base, 'top-level-writer'), true)
})

test('pre-launch containment holds when assignment is slower than CLI startup', { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
  const base = mkdtempSync(join(tmpdir(), 'dsh861-planner-slowassign-'))
  const writer = writeWriterScript(base, 'escape-control')
  const cliScript = join(base, 'cli.mjs')
  writeFileSync(cliScript, [
    "import { spawn } from 'node:child_process'",
    "import { writeFileSync } from 'node:fs'",
    // Module top level: the detached descendant exists before the first stdin
    // read. A bare spawn leaves this descendant outside any assignment that
    // has not landed yet; only creating the CLI after the launcher joined the
    // owned job contains it.
    `const early = spawn(process.execPath, [${JSON.stringify(writer.file)}], { detached: true, stdio: 'ignore' })`,
    'early.unref()',
    "writeFileSync('cli-ran-marker', 'ran')",
    "process.stdout.write('leased echo: ' + process.env.DSH_SEAM_KEY + '\\n')",
    'setInterval(() => {}, 1000)',
  ].join('\n'))
  const promptFile = join(base, 'input.txt')
  writeFileSync(promptFile, 'fixed slow-assignment control input\n')
  const realOwner = await createProcessJobOwner({
    powershellExecutable, directory,
    sha256: { executable: hash(powershellExecutable), helper: hash(join(directory, 'job-owner.ps1')),
      launcher: hash(join(directory, 'launch-gate.mjs')) },
    environment: { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', TEMP: base, TMP: base },
    replyTimeoutMs: 20000,
  })
  // Deterministic race loss: assignment completes 500ms after the process
  // exists, well past a node module top level, so the gate is the only thing
  // standing between the early descendant and an unowned escape.
  const ownership = {
    launch: request => realOwner.launchGated(request),
    assign: async pid => { await delay(500); return realOwner.assign(pid) },
    release: () => realOwner.releaseGated(),
    abort: () => realOwner.abortGated(),
    terminateOwned: () => realOwner.terminateOwned(),
  }
  const bridge = fakeBridge()
  try {
    const result = await invokePlannerOnce({
      approval: { record: 'r', transportEvidenceRecord: 't', subject: { agent: 'codex', model: 'gpt-6-astra',
        reasoningEffort: 'max', baseUrl: 'https://approved.example.invalid/v1' } },
      route: { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
        baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' },
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [cliScript] },
      bridge: bridge.invoke,
      process: { workingDirectory: base, environment: { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows' },
        credentialEnvironmentVariable: 'DSH_SEAM_KEY',
        deadlineMs: 6000, terminationGraceMs: 300, maxChannelBytes: 4096, ownership },
      redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 },
    })
    assert.equal(bridge.observation.reads, 1)
    assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
    assert.equal(result.cancellationReason, 'DEADLINE_EXCEEDED')
    assert.equal(result.ownership?.assigned, true)
    assert.equal(result.ownership?.terminationRequested, true)
    assert.equal(result.redactedStdout.includes(leasedValue), false)
    // The CLI must actually have run: a gate that never releases would make
    // every containment assertion below vacuously true.
    assert.equal(existsSync(join(base, 'cli-ran-marker')), true, 'gated CLI never ran')
    assert.equal(await heartbeatFrozen(base, 'escape-control'), true, 'module-top-level descendant escaped the owned job')
    assert.equal(pidDead(base, 'escape-control'), true)
  } finally {
    await realOwner.dispose().catch(() => {})
    // Cleanup retries never mask the verdict: Windows keeps the directory
    // while a survivor still holds it as its working directory.
    for (let attempt = 0; attempt < 10; attempt++) {
      try { rmSync(base, { recursive: true, force: true }); break } catch { await delay(250) }
    }
  }
})

test('normal completion still terminates surviving descendants of the run', { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
  const { base, spec, workspace } = deployment(t, { stall: false, deadlineMs: 20000 })
  const writer = writeWriterScript(base, 'survivor')
  writeFileSync(join(workspace, 'exec'), [
    "const { spawn } = require('node:child_process')",
    'process.stdin.resume()',
    "process.stdin.on('end', () => {",
    `  const writer = spawn(process.execPath, [${JSON.stringify(writer.file)}], { detached: true, stdio: 'ignore' })`,
    '  writer.unref()',
    '  setTimeout(() => process.exit(0), 200)',
    '})',
  ].join('\n'))
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(result.status, 'PROJECTED_PLANNER_COMPLETED')
  assert.equal(result.invocation.exitCode, 0)
  assert.equal(result.ownership.terminated, true)
  assert.equal(result.ownership.activeProcessesRemaining, 0)
  assert.equal(await heartbeatFrozen(base, 'survivor'), true)
  assert.equal(pidDead(base, 'survivor'), true)
})

test('explicit breakaway out of the owned job fails closed', { skip: process.platform !== 'win32', timeout: 90000 }, async t => {
  const { base, spec, workspace } = deployment(t, { deadlineMs: 4000 })
  const attempt = writeBreakawayAttempt(workspace)
  // The observer is this test's direct child, outside the owned job, so it
  // still works after the job under test terminates. It resolves the exact
  // kernel identity to its own handle; no name scan, no heartbeat inference.
  const observerScript = writeEscapeObserver(base)
  const observedFile = join(base, 'escape-observed.json')
  const realPidFile = join(workspace, 'escape-real.pid')
  const refusalFile = join(workspace, 'escape-refused')
  const observer = spawn(powershellExecutable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', observerScript,
      '-WatchPidFile', realPidFile, '-RefusedFile', refusalFile,
      '-OutFile', observedFile, '-PollMs', '9000', '-WaitMs', '15000'],
    { stdio: ['ignore', 'ignore', 'pipe'] })
  let observerError = ''
  observer.stderr.on('data', chunk => { observerError += chunk })
  const observerClosed = new Promise(resolve => observer.once('close', resolve))
  t.after(async () => {
    try { observer.kill('SIGKILL') } catch { /* already closed */ }
    await Promise.race([observerClosed, delay(5000)])
  })
  writeFileSync(join(workspace, 'exec'), [
    "const { spawn } = require('node:child_process')",
    "const { writeFileSync } = require('node:fs')",
    'process.stdin.resume()',
    "process.stdin.on('end', () => {",
    `  const ps = spawn(${JSON.stringify(powershellExecutable)}, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', ${JSON.stringify(attempt)}], { stdio: ['ignore', 'ignore', 'pipe'] })`,
    "  ps.on('error', () => writeFileSync('breakaway-spawn-error', ''))",
    "  let psErr = ''",
    "  ps.stderr.on('data', c => { psErr += c })",
    "  ps.on('exit', c => { writeFileSync('breakaway-ps-exit', String(c)); if (psErr) writeFileSync('breakaway-ps-stderr', psErr) })",
    '})',
    'setInterval(() => {}, 1000)',
  ].join('\n'))
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(result.status, 'PROJECTED_PLANNER_CANCELLED')
  assert.equal(result.ownership.terminated, true)
  assert.equal(result.ownership.activeProcessesRemaining, 0)
  // Bounded wait for the observer verdict; the job is already gone here.
  const observedDeadline = performance.now() + 25000
  while (!existsSync(observedFile) && performance.now() < observedDeadline) await delay(100)
  assert.equal(existsSync(observedFile), true, `escape observer never reported a verdict; stderr: ${observerError.slice(0, 500)}`)
  const observed = JSON.parse(readFileSync(observedFile, 'utf8'))
  assert.equal(typeof observed.mode, 'string')
  const layoutFile = join(workspace, 'pi-layout')
  const refusalCode = existsSync(refusalFile) ? readFileSync(refusalFile, 'utf8').trim() : 'missing'
  // Two distinct platform outcomes, never collapsed into one guess: the kernel
  // refused the breakaway creation, or it created the process.
  const creationRefused = observed.mode === 'creation-refused'
    && existsSync(refusalFile) && !existsSync(realPidFile)
  // The kernel exit proves containment when the exact process ran its writer
  // payload (escape.log exists) and exited with the job-kill signature: the
  // owner's helper terminates the job with exit code 1 (job-owner.ps1), and a
  // process that actually escaped never exits at all — its batch loops until
  // terminated. Observer liveness fields stay diagnostics because the
  // observer's own cold start can land on either side of the kill.
  const kernelExit = observed.mode === 'kernel-exit' && existsSync(realPidFile)
    && existsSync(join(workspace, 'escape.log')) && Number.isInteger(observed.pid)
    && observed.exitCode === 1
  if (!existsSync(layoutFile) && !creationRefused && !kernelExit) {
    // The probe itself never ran: under a host policy that blocks unsigned
    // script files this is an explicit block, never a containment pass.
    const psExit = existsSync(join(workspace, 'breakaway-ps-exit')) ? readFileSync(join(workspace, 'breakaway-ps-exit'), 'utf8') : 'missing'
    const psStderr = existsSync(join(workspace, 'breakaway-ps-stderr')) ? readFileSync(join(workspace, 'breakaway-ps-stderr'), 'utf8') : ''
    assert.fail(`breakaway probe never ran under the host execution policy (powershell exit=${psExit}): ${psStderr.slice(0, 300)}`)
  }
  if (existsSync(layoutFile)) {
    // PROCESS_INFORMATION: two pointer-width handles, then the two DWORDs.
    const layout = readFileSync(layoutFile, 'utf8')
    const size = Number(/size=(\d+)/.exec(layout)?.[1])
    const pidAt = Number(/pid@(\d+)/.exec(layout)?.[1])
    const tidAt = Number(/tid@(\d+)/.exec(layout)?.[1])
    t.diagnostic(`PROCESS_INFORMATION layout: ${layout}`)
    assert.equal(pidAt, size - 8, 'dwProcessId must sit after both handles')
    assert.equal(tidAt, pidAt + 4, 'dwThreadId must follow dwProcessId')
    assert.equal(size, tidAt + 4, 'struct must end after the two DWORDs')
    assert.equal(existsSync(join(workspace, 'pi-fields-invalid')), false, 'kernel-filled dwProcessId/dwThreadId were absent with the completed struct')
  }
  // Containment holds only with kernel evidence for the exact process: the
  // creation refused outright, or the created process observed to exit by a
  // waiter outside the job. Creation failure elsewhere, open failure,
  // WAIT_FAILED, WAIT_TIMEOUT or a missing PID is recorded as-is and is not
  // death proof; a heartbeat freeze or this test's own cleanup never
  // substitutes for the product's containment or exit ability.
  const writerBeats = existsSync(join(workspace, 'escape.log'))
    ? readFileSync(join(workspace, 'escape.log'), 'utf8').split('\n').filter(line => line.length > 0).length : 0
  t.diagnostic(`breakaway containment mode: ${creationRefused ? 'spawn-refused' : kernelExit ? 'contained-kernel-exit' : 'UNPROVEN'}; observer=${JSON.stringify(observed)}; refusal=${refusalCode}; escape.log beats=${writerBeats}; the job owner terminates with exit code 1`)
  assert.ok(creationRefused || kernelExit,
    `breakaway outcome is unproven or escaped: observer=${JSON.stringify(observed)}, refusal=${refusalCode}, realPidFile=${existsSync(realPidFile)}`)
})

test('helper integrity failure refuses the entry before any credential read', { skip: process.platform !== 'win32' }, async t => {
  const { spec } = deployment(t)
  spec.jobOwner.sha256.helper = '0'.repeat(64)
  const bridge = fakeBridge()
  spec.bridge = bridge.invoke
  const result = await invokeProjectedPlannerOnce(spec)
  assert.equal(result.status, 'PROJECTED_PLANNER_REFUSED')
  assert.equal(result.code, 'OWNER_HELPER_INVALID')
  assert.equal(bridge.observation.reads, 0)
})

test('a failed assignment cancels the run instead of proceeding unowned', { skip: process.platform !== 'win32', timeout: 60000 }, async t => {
  const base = mkdtempSync(join(tmpdir(), 'dsh861-planner-seam-'))
  try {
    const promptFile = join(base, 'input.txt')
    writeFileSync(promptFile, 'fixed input\n')
    const stalled = join(base, 'stalled.mjs')
    writeFileSync(stalled, 'setInterval(() => {}, 1000)\n')
    const bridge = fakeBridge()
    const result = await invokePlannerOnce({
      approval: { record: 'r', transportEvidenceRecord: 't', subject: { agent: 'codex', model: 'gpt-6-astra',
        reasoningEffort: 'max', baseUrl: 'https://approved.example.invalid/v1' } },
      route: { provider: 'my-gpt', model: 'gpt-6-astra', reasoningEffort: 'max',
        baseUrl: 'https://approved.example.invalid/v1', credentialRef: 'secret-reference:providers/codex' },
      prompt: { file: promptFile, sha256: hash(promptFile) },
      cli: { executable: process.execPath, sha256: hash(process.execPath), args: [stalled] },
      bridge: bridge.invoke,
      process: { workingDirectory: base, environment: {}, credentialEnvironmentVariable: 'DSH_SEAM_KEY',
        deadlineMs: 30000, terminationGraceMs: 300, maxChannelBytes: 4096,
        ownership: { assign: async () => false, terminateOwned: async () => false } },
      redactionLimits: { maxSecrets: 1, maxSecretBytes: 384 },
    })
    assert.equal(result.status, 'PLANNER_INVOCATION_CANCELLED')
    assert.equal(result.cancellationReason, 'OWNERSHIP_FAILED')
    assert.equal(result.ownership?.assigned, false)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('owner death is fail-safe: stdin EOF closes the job and kills the tree', { skip: process.platform !== 'win32', timeout: 120000 }, async t => {
  const base = mkdtempSync(join(tmpdir(), 'dsh861-planner-eofsafe-'))
  const writer = writeWriterScript(base, 'orphan')
  const worker = join(base, 'worker.mjs')
  const beatLog = join(base, 'orphan.log').replaceAll('\\', '/')
  writeFileSync(worker, [
    "import { spawn } from 'node:child_process'",
    "import { statSync, writeFileSync } from 'node:fs'",
    `const { createProcessJobOwner } = await import(${JSON.stringify('file:///' + join(directory, 'windows-job-owner.ts').replaceAll('\\', '/'))})`,
    `const owner = await createProcessJobOwner({ powershellExecutable: ${JSON.stringify(powershellExecutable)}, directory: ${JSON.stringify(directory.replaceAll('\\', '/'))},`,
    `  sha256: { executable: ${JSON.stringify(hash(powershellExecutable))}, helper: ${JSON.stringify(hash(join(directory, 'job-owner.ps1')))}, launcher: ${JSON.stringify(hash(join(directory, 'launch-gate.mjs')))} },`,
    `  environment: { SystemRoot: process.env.SystemRoot, TEMP: ${JSON.stringify(base.replaceAll('\\', '/'))}, TMP: ${JSON.stringify(base.replaceAll('\\', '/'))} }, replyTimeoutMs: 20000 })`,
    `const child = spawn(process.execPath, [${JSON.stringify(writer.file.replaceAll('\\', '/'))}], { detached: true, stdio: 'ignore' })`,
    'child.unref()',
    `const beat = ${JSON.stringify(beatLog)}`,
    'const end = Date.now() + 15000',
    'while (Date.now() < end) { try { if (statSync(beat).size >= 5) break } catch {} await new Promise(r => setTimeout(r, 50)) }',
    `writeFileSync(${JSON.stringify(join(base, 'assigned').replaceAll('\\', '/'))}, String(await owner.assign(child.pid)))`,
    'process.exit(0)',
  ].join('\n'))
  // Resolve `tsx` from the repository, not from the throwaway cwd.
  const child = spawn(process.execPath, ['--import', 'tsx/esm', worker], { stdio: 'ignore', cwd: repository })
  await new Promise(resolve => child.on('exit', resolve))
  assert.equal(readFileSync(join(base, 'assigned'), 'utf8'), 'true')
  assert.equal(await heartbeatFrozen(base, 'orphan', 2500), true, 'job survived the owning process death')
  assert.equal(pidDead(base, 'orphan'), true)
  t.after(() => { rmSync(base, { recursive: true, force: true }) })
})

test('operations after disposal report failure instead of containment', { skip: process.platform !== 'win32', timeout: 60000 }, async t => {
  const base = mkdtempSync(join(tmpdir(), 'dsh861-planner-disposed-'))
  const owner = await createProcessJobOwner({
    powershellExecutable, directory,
    sha256: { executable: hash(powershellExecutable), helper: hash(join(directory, 'job-owner.ps1')),
      launcher: hash(join(directory, 'launch-gate.mjs')) },
    environment: { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', TEMP: base, TMP: base },
    replyTimeoutMs: 20000,
  })
  try {
    assert.equal(await owner.assign(-1), false)
    assert.equal(await owner.activeProcesses(), 0)
    await owner.dispose()
    assert.equal(await owner.terminateOwned(), false)
    assert.equal(await owner.assign(process.pid), false)
    assert.equal(await owner.activeProcesses(), -1)
  } finally {
    await owner.dispose().catch(() => {})
    rmSync(base, { recursive: true, force: true })
  }
})

test('cancelling one owned invocation leaves a concurrent unrelated one intact', { skip: process.platform !== 'win32', timeout: 120000 }, async t => {
  const stalled = deployment(t, { deadlineMs: 1200 })
  const quick = deployment(t, { stall: false, deadlineMs: 20000 })
  const stalledWriter = writeWriterScript(stalled.base, 'stalled-writer')
  const quickWriter = writeWriterScript(quick.base, 'quick-writer')
  writeFileSync(join(stalled.workspace, 'exec'), [
    "const { spawn } = require('node:child_process')",
    'process.stdin.resume()',
    "process.stdin.on('end', () => {",
    `  const writer = spawn(process.execPath, [${JSON.stringify(stalledWriter.file)}], { detached: true, stdio: 'ignore' })`,
    '  writer.unref()',
    '})',
    'setInterval(() => {}, 1000)',
  ].join('\n'))
  writeFileSync(join(quick.workspace, 'exec'), [
    "const { spawn } = require('node:child_process')",
    'process.stdin.resume()',
    "process.stdin.on('end', () => {",
    `  const writer = spawn(process.execPath, [${JSON.stringify(quickWriter.file)}], { detached: true, stdio: 'ignore' })`,
    '  writer.unref()',
    '  setTimeout(() => process.exit(0), 200)',
    '})',
  ].join('\n'))
  const stalledBridge = fakeBridge()
  const quickBridge = fakeBridge()
  stalled.spec.bridge = stalledBridge.invoke
  quick.spec.bridge = quickBridge.invoke
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  try {
    const [stalledResult, quickResult] = await Promise.all([
      invokeProjectedPlannerOnce(stalled.spec),
      invokeProjectedPlannerOnce(quick.spec),
    ])
    assert.equal(stalledResult.status, 'PROJECTED_PLANNER_CANCELLED')
    assert.equal(stalledResult.invocation.cancellationReason, 'DEADLINE_EXCEEDED')
    assert.equal(quickResult.status, 'PROJECTED_PLANNER_COMPLETED')
    assert.equal(quickResult.invocation.exitCode, 0)
    assert.equal(stalledResult.ownership.activeProcessesRemaining, 0)
    assert.equal(quickResult.ownership.activeProcessesRemaining, 0)
    assert.equal(await heartbeatFrozen(stalled.base, 'stalled-writer'), true)
    assert.equal(await heartbeatFrozen(quick.base, 'quick-writer'), true)
    try { process.kill(unrelated.pid, 0) } catch { assert.fail('unrelated process was killed by an owned invocation') }
  } finally {
    try { process.kill(unrelated.pid) } catch { /* already gone */ }
  }
})
