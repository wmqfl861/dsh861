import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { constants, createHash, generateKeyPair, privateDecrypt, randomBytes } from 'node:crypto'
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { checkWindowsCredentialBridge, createWindowsBridge, WindowsCredentialError } from './reader.ts'

// This suite writes/removes only unique synthetic dsh861/selftest/* credentials.
// It never touches the four production references or any model endpoint.
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const directory = fileURLToPath(new URL('.', import.meta.url))
const powershellExecutable = join(process.env.SystemRoot ?? '', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

/** Run a generated runner script by -File like the sealed bridge; -EncodedCommand emits CLIXML progress on stderr. */
function runScript(script, input) {
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-credential-native-'))
  try {
    const runner = join(temporary, 'runner.ps1')
    writeFileSync(runner, script)
    return spawnSync(powershellExecutable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', runner],
      { input, timeout: 50000, windowsHide: true, shell: false, encoding: 'buffer', cwd: directory,
        env: { SystemRoot: process.env.SystemRoot ?? '', TEMP: temporary, TMP: temporary } })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

test('Windows native store and sealed transport round-trip; not product acceptance', {
  skip: process.platform !== 'win32', timeout: 60000,
}, async () => {
  assert.equal(typeof process.env.SystemRoot, 'string')
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-credential-selftest-'))
  try {
    const spec = { powershellExecutable, directory, timeoutMs: 45000,
      // Tests inspect the local files; production pins come from trusted approval.
      sha256: { executable: hash(powershellExecutable), bridge: hash(join(directory, 'bridge.ps1')),
        nativeSource: hash(join(directory, 'native-credential.cs')) },
      environment: { SystemRoot: process.env.SystemRoot, TEMP: temporary, TMP: temporary } }
    await assert.rejects(createWindowsBridge({ ...spec, sha256: { ...spec.sha256, bridge: '0'.repeat(64) } })(
      'SelfTest', undefined, Buffer.from('{}')), WindowsCredentialError)
    const invoke = createWindowsBridge(spec)
    const result = await checkWindowsCredentialBridge((action, provider, request) => {
      const { requestId } = JSON.parse(request)
      console.info(`Synthetic target only: dsh861/selftest/${requestId}`)
      return invoke(action, provider, request)
    })
    assert.deepEqual(result, { status: 'SYNTHETIC_STORE_ROUNDTRIP', productAccepted: false })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

test('bridge and management scripts parse under the in-box Windows PowerShell', {
  skip: process.platform !== 'win32', timeout: 60000,
}, () => {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$directory = '" + directory + "'",
    "foreach ($name in @('bridge.ps1','manage.ps1')) {",
    '    $tokens = $null; $errors = $null',
    '    [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $directory $name), [ref]$tokens, [ref]$errors) | Out-Null',
    "    Write-Output ($name + ':' + $errors.Count)",
    '}',
  ].join('\r\n')
  const result = runScript(script)
  assert.equal(result.status, 0)
  assert.deepEqual(result.stdout.toString().trim().split(/\r?\n/), ['bridge.ps1:0', 'manage.ps1:0'])
})

test('hidden-input confirmation mismatch is refused; a matching pair stores, seals and cleans up', {
  skip: process.platform !== 'win32', timeout: 90000,
}, async () => {
  const { publicKey, privateKey } = await new Promise((resolve, reject) =>
    generateKeyPair('rsa', { modulusLength: 4096, publicExponent: 65537 }, (error, pub, priv) =>
      error ? reject(error) : resolve({ publicKey: pub, privateKey: priv })))
  const jwk = publicKey.export({ format: 'jwk' })
  const requestId = randomBytes(16).toString('hex')
  console.info(`Synthetic target only: dsh861/selftest/${requestId}`)
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false, $true)",
    '$request = [Console]::In.ReadToEnd() | ConvertFrom-Json',
    "Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path '" + directory + "' 'native-credential.cs') -Raw -Encoding UTF8) | Out-Null",
    '# Build SecureStrings char by char, as Read-Host -AsSecureString does; avoid cmdlet module autoload.',
    'function New-Secret([string]$Value) {',
    '    $secret = New-Object System.Security.SecureString',
    '    foreach ($character in $Value.ToCharArray()) { $secret.AppendChar($character) }',
    '    $secret.MakeReadOnly()',
    '    $secret',
    '}',
    "$first = New-Secret ('dsh861-synthetic-first-' + $request.requestId)",
    "$second = New-Secret ('dsh861-synthetic-second-' + $request.requestId)",
    '$ciphertext = [Dsh861.Credentials.NativeCredential]::SelfTestStore('
    + '$request.requestId, $first, $second, $second, $request.modulus, $request.exponent)',
    '[Console]::Out.Write($ciphertext)',
  ].join('\r\n')
  const input = Buffer.from(JSON.stringify({ version: 1, requestId,
    modulus: Buffer.from(jwk.n, 'base64url').toString('base64'),
    exponent: Buffer.from(jwk.e, 'base64url').toString('base64') }))
  const result = runScript(script, input)
  assert.equal(result.status, 0, `stderr: ${result.stderr.toString()}`)
  assert.equal(result.stderr.length, 0)
  const plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256' }, Buffer.from(result.stdout.toString('ascii').trim(), 'base64'))
  assert.equal(plaintext.toString('ascii'), `dsh861-synthetic-second-${requestId}`)
})

test('management Set refuses redirected hidden input instead of prompting or storing', {
  skip: process.platform !== 'win32', timeout: 60000,
}, () => {
  const result = spawnSync(powershellExecutable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(directory, 'manage.ps1'),
      '-Action', 'Set', '-Provider', 'codex'],
    { input: Buffer.alloc(0), timeout: 50000, windowsHide: true, shell: false, encoding: 'buffer' })
  assert.notEqual(result.status, 0)
  assert.equal(result.stdout.toString().includes('"provider"'), false)
  assert.equal(result.stderr.toString().includes('CREDENTIAL_OPERATION_REFUSED'), true)
})

test('management Remove declines under -WhatIf without emitting a completed status', {
  skip: process.platform !== 'win32', timeout: 60000,
}, () => {
  const result = spawnSync(powershellExecutable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(directory, 'manage.ps1'),
      '-Action', 'Remove', '-Provider', 'codex', '-WhatIf'],
    { timeout: 50000, windowsHide: true, shell: false, encoding: 'buffer' })
  assert.equal(result.status, 0)
  assert.equal(result.stderr.length, 0)
  const output = result.stdout.toString()
  assert.equal(output.includes('"provider"'), false)
  assert.equal(output.includes('PRESENT_'), false)
})
