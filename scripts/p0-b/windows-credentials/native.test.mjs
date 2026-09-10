import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { checkWindowsCredentialBridge, createWindowsBridge, WindowsCredentialError } from './reader.ts'

// This suite writes/removes only one unique synthetic dsh861/selftest/* credential.
// It never touches the four production references or any model endpoint.
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const directory = fileURLToPath(new URL('.', import.meta.url))

test('Windows native store and sealed transport round-trip; not product acceptance', {
  skip: process.platform !== 'win32', timeout: 60000,
}, async () => {
  const root = process.env.SystemRoot
  assert.equal(typeof root, 'string')
  const powershellExecutable = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const temporary = mkdtempSync(join(tmpdir(), 'dsh861-credential-selftest-'))
  try {
    const spec = { powershellExecutable, directory, timeoutMs: 45000,
      // Tests inspect the local files; production pins come from trusted approval.
      sha256: { executable: hash(powershellExecutable), bridge: hash(join(directory, 'bridge.ps1')),
        nativeSource: hash(join(directory, 'native-credential.cs')) },
      environment: { SystemRoot: root, TEMP: temporary, TMP: temporary } }
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
