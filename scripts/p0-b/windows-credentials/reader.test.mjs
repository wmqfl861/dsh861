import assert from 'node:assert/strict'
import { createPublicKey, publicEncrypt, constants } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inspect } from 'node:util'
import test from 'node:test'

const root = process.env.P0B_WINDOWS_CREDENTIAL_MODULE_ROOT
const readerUrl = root ? pathToFileURL(join(root, 'windows-credentials/reader.js')) : new URL('./reader.ts', import.meta.url)
const leaseUrl = root ? pathToFileURL(join(root, 'credential-ref.js')) : new URL('../credential-ref.ts', import.meta.url)
const { createSealedCredentialReaders, checkWindowsCredentialBridge, createWindowsBridge, WindowsCredentialError } = await import(readerUrl)
const { resolveCredentialReferences, parseCredentialRef } = await import(leaseUrl)
const sentinel = 'SYNTHETIC-KEY-NOT-A-REAL-CREDENTIAL-7d931'
const sourceRoot = new URL('.', import.meta.url)

function packet(request, value = sentinel) {
  const key = createPublicKey({ format: 'jwk', key: { kty: 'RSA',
    n: Buffer.from(request.modulus, 'base64').toString('base64url'),
    e: Buffer.from(request.exponent, 'base64').toString('base64url') } })
  const ciphertext = publicEncrypt({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.isBuffer(value) ? value : Buffer.from(value)).toString('base64')
  return { version: 1, requestId: request.requestId, status: 'SEALED', ciphertext, selfTestRemoved: false }
}

function fakeBridge(transform, value = sentinel) {
  const observation = { calls: 0, request: undefined, buffer: undefined }
  const invoke = async (action, provider, requestBytes) => {
    observation.calls++
    assert.equal(action, 'Read')
    observation.provider = provider
    observation.request = JSON.parse(requestBytes.toString())
    assert.equal(requestBytes.includes(sentinel), false)
    const p = packet(observation.request, value)
    const edited = transform ? transform(p) : p
    observation.buffer = Buffer.isBuffer(edited) ? edited : Buffer.from(JSON.stringify(edited))
    return observation.buffer
  }
  return { observation, invoke }
}

for (const provider of ['codex', 'claude-code', 'grok', 'opencode']) {
  test(`resolves only the granted ${provider} reference through a sealed response`, async () => {
    const fake = fakeBridge()
    const readers = createSealedCredentialReaders(fake.invoke, [`providers/${provider}`])
    assert.equal(await readers.readSecret(`providers/${provider}`), sentinel)
    assert.equal(fake.observation.calls, 1)
    assert.equal(fake.observation.provider, provider)
    assert.equal(fake.observation.buffer.every(byte => byte === 0), true)
    assert.equal(readers.readEnv('OPENAI_API_KEY'), undefined)
  })
}

test('denies other providers and foreign namespaces before transport or key generation', async () => {
  let calls = 0
  const readers = createSealedCredentialReaders(async () => { calls++; throw new Error('never') }, ['providers/codex'])
  for (const id of ['providers/grok', 'providers/CODEX', '../codex', 'other-project/key', '', 'providers/codex\n']) {
    await assert.rejects(readers.readSecret(id), WindowsCredentialError)
  }
  assert.equal(calls, 0)
})

test('copies the granted reference set instead of widening after caller mutation', async () => {
  const grants = ['providers/codex']
  const fake = fakeBridge()
  const readers = createSealedCredentialReaders(fake.invoke, grants)
  grants.push('providers/grok')
  await assert.rejects(readers.readSecret('providers/grok'), WindowsCredentialError)
  assert.equal(fake.observation.calls, 0)
})

test('rejects an invalid grant before creating a reader', () => {
  assert.throws(() => createSealedCredentialReaders(async () => Buffer.alloc(0), ['anything']), WindowsCredentialError)
})

test('retains existing source-to-environment authorization and one-shot lease behavior', async () => {
  const fake = fakeBridge()
  const readers = createSealedCredentialReaders(fake.invoke, ['providers/codex'])
  const binding = { source: parseCredentialRef('secret-reference:providers/codex'), targetEnv: 'DSH_CODEX_API_KEY' }
  await assert.rejects(resolveCredentialReferences([binding], [], readers), { blockReason: 'CREDENTIAL_SOURCE_FORBIDDEN' })
  assert.equal(fake.observation.calls, 0)
  const lease = await resolveCredentialReferences([binding], [binding], readers)
  assert.equal(JSON.stringify(lease).includes(sentinel), false)
  assert.equal(inspect(lease).includes(sentinel), false)
  assert.equal(await lease.use((env, values) => env.DSH_CODEX_API_KEY === sentinel && values[0] === sentinel), true)
  await assert.rejects(lease.use(() => true), { blockReason: 'CREDENTIAL_LEASE_CLOSED' })
})

test('missing credential remains missing rather than borrowing environment or another provider', async () => {
  const readers = createSealedCredentialReaders(async (_a, _p, input) => {
    const request = JSON.parse(input)
    return Buffer.from(JSON.stringify({ version: 1, requestId: request.requestId,
      status: 'MISSING', ciphertext: null, selfTestRemoved: false }))
  }, ['providers/codex'])
  assert.equal(await readers.readSecret('providers/codex'), undefined)
})

const malformed = [
  ['wrong request identity', p => ({ ...p, requestId: '0'.repeat(32) })],
  ['wrong version', p => ({ ...p, version: 2 })],
  ['plaintext field', p => ({ ...p, value: sentinel })],
  ['wrong mode', p => ({ ...p, selfTestRemoved: true })],
  ['invalid ciphertext', p => ({ ...p, ciphertext: 'A'.repeat(683) + '=' })],
  ['missing with ciphertext', p => ({ ...p, status: 'MISSING' })],
  ['unknown status', p => ({ ...p, status: 'PASS' })],
  ['truncated JSON', () => Buffer.from('{"value":"' + sentinel)],
  ['oversized packet', () => Buffer.alloc(4097, 65)],
  ['array packet', () => []],
]
for (const [name, transform] of malformed) {
  test(`refuses ${name} without echoing untrusted bytes`, async () => {
    const fake = fakeBridge(transform)
    const readers = createSealedCredentialReaders(fake.invoke, ['providers/codex'])
    await assert.rejects(readers.readSecret('providers/codex'), error => {
      assert.equal(error.message, 'WINDOWS_CREDENTIAL_READ_FAILED')
      assert.equal(error.cause, undefined)
      assert.equal(inspect(error).includes(sentinel), false)
      return true
    })
    assert.equal(fake.observation.buffer.every(byte => byte === 0), true)
  })
}

for (const [name, value] of [['empty', ''], ['newline', 'bad\nkey'], ['non-ASCII', Buffer.from([0xff])],
  ['too long', 'x'.repeat(385)]]) {
  test(`rejects ${name} decrypted credential`, async () => {
    const fake = fakeBridge(undefined, value)
    const readers = createSealedCredentialReaders(fake.invoke, ['providers/codex'])
    await assert.rejects(readers.readSecret('providers/codex'), WindowsCredentialError)
  })
}

test('accepts the documented maximum without truncation', async () => {
  const value = 'x'.repeat(384)
  const fake = fakeBridge(undefined, value)
  assert.equal(await createSealedCredentialReaders(fake.invoke, ['providers/codex']).readSecret('providers/codex'), value)
})

test('native exception content is not attached to the reader failure', async () => {
  const readers = createSealedCredentialReaders(async () => { throw new Error(sentinel) }, ['providers/codex'])
  await assert.rejects(readers.readSecret('providers/codex'), error => {
    assert.equal(error.message, 'WINDOWS_CREDENTIAL_READ_FAILED')
    assert.equal(error.cause, undefined)
    return true
  })
})

test('synthetic self-test checks ciphertext, replacement value and cleanup acknowledgment', async () => {
  const result = await checkWindowsCredentialBridge(async (action, provider, input) => {
    assert.equal(action, 'SelfTest')
    assert.equal(provider, undefined)
    const request = JSON.parse(input)
    const result = packet(request, `dsh861-synthetic-second-${request.requestId}`)
    result.selfTestRemoved = true
    return Buffer.from(JSON.stringify(result))
  })
  assert.deepEqual(result, { status: 'SYNTHETIC_STORE_ROUNDTRIP', productAccepted: false })
})

test('refuses a self-test that cannot confirm native cleanup', async () => {
  await assert.rejects(checkWindowsCredentialBridge(async (_action, _provider, input) => {
    const request = JSON.parse(input)
    return Buffer.from(JSON.stringify(packet(request, `dsh861-synthetic-second-${request.requestId}`)))
  }), WindowsCredentialError)
})

test('management interface contains no key-valued argument or plaintext export mode', () => {
  const management = readFileSync(new URL('manage.ps1', sourceRoot), 'utf8')
  assert.match(management, /Read-Host[^\n]+-AsSecureString/)
  assert.doesNotMatch(management, /\[string\]\$(?:Key|Password|Secret)\b/i)
  assert.match(management, /SupportsShouldProcess/)
  assert.doesNotMatch(management, /cmdkey|ConvertFrom-SecureString|Set-Content|WriteAllText/)
  const bridge = readFileSync(new URL('bridge.ps1', sourceRoot), 'utf8')
  assert.match(bridge, /'Read', 'SelfTest'/)
  assert.doesNotMatch(bridge, /ExecutionPolicy.*Bypass|WriteAllText|Set-Content/)
  const native = readFileSync(new URL('native-credential.cs', sourceRoot), 'utf8')
  assert.match(native, /RSAEncryptionPadding\.OaepSHA256/)
  assert.doesNotMatch(native, /CredEnumerate|GetEnvironmentVariable|ReadAllText/)
})

test('Windows transport is unavailable on other platforms without running any process', { skip: process.platform === 'win32' }, async () => {
  await assert.rejects(createWindowsBridge({})('Read', 'codex', Buffer.from('{}')), WindowsCredentialError)
})
