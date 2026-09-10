import { spawn } from 'node:child_process'
import { constants, createHash, generateKeyPair, privateDecrypt, randomBytes, type KeyObject } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { CredentialReaders } from '../credential-ref.ts'

export type ProviderSecretId = 'providers/codex' | 'providers/claude-code' | 'providers/grok' | 'providers/opencode'
export type BridgeAction = 'Read' | 'SelfTest'

/** Trusted private transport; its response must never be forwarded to logs. */
export type SealedBridge = (action: BridgeAction, provider: string | undefined, publicRequest: Buffer) => Promise<Buffer>

export class WindowsCredentialError extends Error {
  constructor() { super('WINDOWS_CREDENTIAL_READ_FAILED'); this.name = 'WindowsCredentialError' }
}

function providerFor(id: string): string {
  switch (id) {
    case 'providers/codex': case 'providers/claude-code': case 'providers/grok': case 'providers/opencode':
      return id.slice('providers/'.length)
    default: throw new WindowsCredentialError()
  }
}

function rsaKeyPair(): Promise<{ publicKey: KeyObject; privateKey: KeyObject }> {
  return new Promise((resolve, reject) => {
    generateKeyPair('rsa', { modulusLength: 4096, publicExponent: 65537 }, (error, publicKey, privateKey) => {
      if (error) reject(new WindowsCredentialError())
      else resolve({ publicKey, privateKey })
    })
  })
}

/**
 * Exchange one ephemeral RSA envelope. Public-key material alone crosses stdin;
 * a credential can leave native stdout only encrypted to this invocation's key.
 * This protects incidental process-output capture, not a compromised OS user.
 */
async function receive(invoke: SealedBridge, action: BridgeAction, provider?: string): Promise<string | undefined> {
  let response: Buffer | undefined
  let plaintext: Buffer | undefined
  try {
    const { publicKey, privateKey } = await rsaKeyPair()
    const jwk = publicKey.export({ format: 'jwk' })
    const requestId = randomBytes(16).toString('hex')
    const request = Buffer.from(JSON.stringify({ version: 1, requestId,
      modulus: Buffer.from(jwk.n as string, 'base64url').toString('base64'),
      exponent: Buffer.from(jwk.e as string, 'base64url').toString('base64') }))
    response = await invoke(action, provider, request)
    if (!Buffer.isBuffer(response) || response.length > 4096) throw new WindowsCredentialError()
    const decoded: unknown = JSON.parse(response.toString('utf8'))
    if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) throw new WindowsCredentialError()
    const packet = decoded as Record<string, unknown>
    if (Object.keys(packet).sort().join(',') !== 'ciphertext,requestId,selfTestRemoved,status,version'
      || packet.version !== 1 || packet.requestId !== requestId
      || packet.selfTestRemoved !== (action === 'SelfTest')) throw new WindowsCredentialError()
    if (packet.status === 'MISSING' && packet.ciphertext === null && action === 'Read') return undefined
    if (packet.status !== 'SEALED' || typeof packet.ciphertext !== 'string'
      || !/^[A-Za-z0-9+/]{683}=$/.test(packet.ciphertext)) throw new WindowsCredentialError()
    const encrypted = Buffer.from(packet.ciphertext, 'base64')
    if (encrypted.length !== 512 || encrypted.toString('base64') !== packet.ciphertext) throw new WindowsCredentialError()
    plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256' }, encrypted)
    if (plaintext.length < 1 || plaintext.length > 384 || plaintext.some(value => value < 33 || value > 126)) {
      throw new WindowsCredentialError()
    }
    const value = plaintext.toString('ascii')
    if (action === 'SelfTest' && value !== `dsh861-synthetic-second-${requestId}`) throw new WindowsCredentialError()
    return value
  } catch {
    // Neither native stderr, ciphertext, parse input, nor callback errors are attached.
    throw new WindowsCredentialError()
  } finally {
    if (Buffer.isBuffer(response)) response.fill(0)
    plaintext?.fill(0)
  }
}

/**
 * Build a least-privilege reader from a trusted transport and explicit reference grants.
 * The existing resolveCredentialReferences still checks each source-to-env binding.
 * @param invoke - reviewed private bridge implementation, never a model-provided executable.
 * @param allowedIds - approved references for this operation, not a discovery request.
 * @returns readers for the existing credential-lease interface; no environment fallback.
 */
export function createSealedCredentialReaders(
  invoke: SealedBridge,
  allowedIds: readonly ProviderSecretId[],
): CredentialReaders {
  for (const id of allowedIds) providerFor(id)
  const allowed = new Set(allowedIds)
  return {
    readEnv: () => undefined,
    readSecret: async (id) => {
      const provider = providerFor(id)
      if (!allowed.has(id as ProviderSecretId)) throw new WindowsCredentialError()
      return receive(invoke, 'Read', provider)
    },
  }
}

/** Explicit execution inputs owned by the trusted caller, independent of model configuration. */
export interface WindowsBridgeSpec {
  powershellExecutable: string
  directory: string
  sha256: { executable: string; bridge: string; nativeSource: string }
  environment: Readonly<{ SystemRoot: string; TEMP: string; TMP: string }>
  timeoutMs: number
}

async function checkedFile(path: string, expectedSha256: string): Promise<void> {
  if (!isAbsolute(path) || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new WindowsCredentialError()
  const bytes = await readFile(path)
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) throw new WindowsCredentialError()
}

/**
 * Create a Windows transport that launches no model and never inherits ambient credentials.
 * Integrity inputs must come from a separately approved deployment, not arbitrary project files.
 * @param spec - exact executable, owned helper directory, hashes, environment and deadline.
 * @returns a private-pipe invoker with bounded capture and generic errors.
 */
export function createWindowsBridge(spec: WindowsBridgeSpec): SealedBridge {
  return async (action, provider, request) => {
    try {
      if (process.platform !== 'win32' || !isAbsolute(spec.directory)
        || !Number.isSafeInteger(spec.timeoutMs) || spec.timeoutMs < 1
        || spec.timeoutMs > 2147483647) throw new WindowsCredentialError()
      if (action === 'Read') providerFor(`providers/${provider}`)
      else if (provider !== undefined) throw new WindowsCredentialError()
      if (!Buffer.isBuffer(request) || request.length > 4096) throw new WindowsCredentialError()
      for (const value of [spec.environment.SystemRoot, spec.environment.TEMP, spec.environment.TMP]) {
        if (!isAbsolute(value) || /[\0\r\n]/.test(value)) throw new WindowsCredentialError()
      }
      const directory = await realpath(spec.directory)
      // The trusted owner must prevent concurrent modification of these deployment files.
      const script = join(directory, 'bridge.ps1')
      await checkedFile(spec.powershellExecutable, spec.sha256.executable)
      await checkedFile(script, spec.sha256.bridge)
      await checkedFile(join(directory, 'native-credential.cs'), spec.sha256.nativeSource)
      return await new Promise<Buffer>((resolve, reject) => {
        const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, '-Action', action]
        if (provider !== undefined) args.push('-Provider', provider)
        const child = spawn(spec.powershellExecutable, args, { cwd: directory, windowsHide: true,
          shell: false, env: { SystemRoot: spec.environment.SystemRoot, TEMP: spec.environment.TEMP,
            TMP: spec.environment.TMP }, stdio: ['pipe', 'pipe', 'pipe'] })
        const chunks: Buffer[] = []
        let size = 0
        let settled = false
        const finish = (ok: boolean): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          const result = ok ? Buffer.concat(chunks) : undefined
          for (const chunk of chunks) chunk.fill(0)
          chunks.length = 0
          if (!ok) {
            child.kill()
            child.stdin.destroy()
            child.stdout.destroy()
            child.stderr.destroy()
          }
          if (result) resolve(result)
          else reject(new WindowsCredentialError())
        }
        const timer = setTimeout(() => { finish(false) }, spec.timeoutMs)
        child.on('error', () => { finish(false) })
        child.stdin.on('error', () => { finish(false) })
        child.stdout.on('error', () => { finish(false) })
        child.stderr.on('error', () => { finish(false) })
        child.stdout.on('data', (chunk: Buffer) => {
          if (settled) { chunk.fill(0); return }
          size += chunk.length
          if (size > 4096) { chunk.fill(0); finish(false); return }
          chunks.push(Buffer.from(chunk))
          chunk.fill(0)
        })
        child.stderr.on('data', (chunk: Buffer) => {
          // A native failure is not a source of host diagnostics or secret-bearing causes.
          chunk.fill(0)
          finish(false)
        })
        child.on('close', (code, signal) => { finish(code === 0 && signal === null) })
        child.stdin.end(request)
      })
    } catch { throw new WindowsCredentialError() }
  }
}

/**
 * Exercise a throwaway native target only, including replacement rejection and cleanup.
 * @param invoke - private Windows bridge or an explicitly declared test double.
 * @returns a keyless transport result, never product acceptance or rotation confirmation.
 */
export async function checkWindowsCredentialBridge(invoke: SealedBridge): Promise<{
  status: 'SYNTHETIC_STORE_ROUNDTRIP'
  productAccepted: false
}> {
  await receive(invoke, 'SelfTest')
  return { status: 'SYNTHETIC_STORE_ROUNDTRIP', productAccepted: false }
}
