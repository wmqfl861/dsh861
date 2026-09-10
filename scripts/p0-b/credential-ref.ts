/** Explicit, granted credential references for P0-B. No ambient or filesystem discovery. */
export type CredentialRef =
  | { kind: 'env'; name: string }
  | { kind: 'secret-reference'; id: string }

/** A source-to-target mapping approved by the caller's authorization layer. */
export interface CredentialBinding {
  source: CredentialRef
  targetEnv: string
}

/** Injected trusted readers. This module never reads process.env or files itself. */
export interface CredentialReaders {
  readEnv: (name: string) => string | undefined
  readSecret?: (id: string) => Promise<string | undefined>
}

/** Safe metadata; contains neither the value nor any value-derived digest. */
export interface CredentialMetadata {
  source: CredentialRef
  targetEnv: string
  presentFingerprint: 'nonempty'
}

export type CredentialFailure =
  | 'CREDENTIAL_SOURCE_FORBIDDEN'
  | 'CREDENTIAL_MISSING'
  | 'CREDENTIAL_SOURCE_UNAVAILABLE'
  | 'CREDENTIAL_VALUE_INVALID'
  | 'CREDENTIAL_LEASE_CLOSED'
  | 'CREDENTIAL_OPERATION_FAILED'

/** Fixed diagnostics deliberately omit the underlying source error and value. */
export class CredentialError extends Error {
  constructor(readonly blockReason: CredentialFailure) {
    super(blockReason)
    this.name = 'CredentialError'
  }
}

/** One-shot access; retaining a copy outside the callback is forbidden by contract. */
export interface CredentialLease {
  metadata(): CredentialMetadata[]
  use<T>(operation: (
    targetEnvironment: Readonly<Record<string, string>>,
    redactionValues: readonly string[],
  ) => T | Promise<T>): Promise<T>
  dispose(): void
  toJSON(): { credentials: CredentialMetadata[]; usable: boolean }
}

const ENV_NAME = /^[A-Z_][A-Z0-9_]{0,127}$/
const SECRET_ID = /^[A-Za-z0-9][A-Za-z0-9_.\/-]{0,127}$/
const PROCESS_CONTROL = new Set([
  'PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'COMSPEC', 'SHELL', 'SYSTEMROOT',
  'NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME',
])

function forbidden(): never { throw new CredentialError('CREDENTIAL_SOURCE_FORBIDDEN') }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

/** Parse references only, never literal credential values or file paths. */
export function parseCredentialRef(value: unknown): CredentialRef {
  if (typeof value !== 'string') forbidden()
  if (value.startsWith('env:') && ENV_NAME.test(value.slice(4))) {
    return { kind: 'env', name: value.slice(4) }
  }
  if (value.startsWith('secret-reference:') && SECRET_ID.test(value.slice(17))) {
    return { kind: 'secret-reference', id: value.slice(17) }
  }
  return forbidden()
}

function refKey(value: unknown): string {
  if (!object(value)) forbidden()
  if (value.kind === 'env' && exactKeys(value, ['kind', 'name'])
    && typeof value.name === 'string' && ENV_NAME.test(value.name)) return `env:${value.name}`
  if (value.kind === 'secret-reference' && exactKeys(value, ['kind', 'id'])
    && typeof value.id === 'string' && SECRET_ID.test(value.id)) return `secret-reference:${value.id}`
  return forbidden()
}

function bindingKey(value: unknown): string {
  if (!object(value) || !exactKeys(value, ['source', 'targetEnv'])
    || typeof value.targetEnv !== 'string' || !ENV_NAME.test(value.targetEnv)
    || PROCESS_CONTROL.has(value.targetEnv)) forbidden()
  return `${refKey(value.source)}\0${value.targetEnv}`
}

class OneShotLease implements CredentialLease {
  #values: string[]
  #metadata: CredentialMetadata[]
  #usable = true

  constructor(metadata: CredentialMetadata[], values: string[]) {
    this.#metadata = metadata
    this.#values = values
  }

  metadata(): CredentialMetadata[] {
    return this.#metadata.map(item => ({ ...item, source: { ...item.source } }))
  }

  async use<T>(operation: (
    targetEnvironment: Readonly<Record<string, string>>,
    redactionValues: readonly string[],
  ) => T | Promise<T>): Promise<T> {
    if (!this.#usable) throw new CredentialError('CREDENTIAL_LEASE_CLOSED')
    this.#usable = false
    const environment: Record<string, string> = Object.create(null) as Record<string, string>
    const values = this.#values.slice()
    for (const [index, item] of this.#metadata.entries()) {
      environment[item.targetEnv] = values[index] as string
    }
    try {
      return await operation(environment, values)
    } catch {
      // A callback/source error may itself contain a credential. Never attach it as cause.
      throw new CredentialError('CREDENTIAL_OPERATION_FAILED')
    } finally {
      try {
        for (const name of Object.keys(environment)) Reflect.deleteProperty(environment, name)
        values.fill('')
        values.length = 0
      } catch {
        // A callback can freeze or retain its copies; still release our own references.
      } finally { this.dispose() }
    }
  }

  dispose(): void {
    this.#usable = false
    this.#values.fill('')
    this.#values.length = 0
  }

  toJSON(): { credentials: CredentialMetadata[]; usable: boolean } {
    return { credentials: this.metadata(), usable: this.#usable }
  }

  [Symbol.for('nodejs.util.inspect.custom')](): unknown { return this.toJSON() }
}

/**
 * Resolve only bindings present in grants. All mappings are checked before any read.
 * Readers are injected so missing references cannot fall back to global configuration.
 * No provider/model/endpoint settings are read or changed by this operation.
 */
export async function resolveCredentialReferences(
  requests: readonly CredentialBinding[],
  grants: readonly CredentialBinding[],
  readers: CredentialReaders,
): Promise<CredentialLease> {
  if (!Array.isArray(requests) || !Array.isArray(grants)) forbidden()
  if (requests.length === 0) throw new CredentialError('CREDENTIAL_MISSING')
  const authorized = new Set(grants.map(bindingKey))
  const targets = new Set<string>()
  const resolvedBindings = requests.map((request: CredentialBinding) => {
    const key = bindingKey(request)
    if (!authorized.has(key) || targets.has(request.targetEnv)) forbidden()
    targets.add(request.targetEnv)
    return { source: { ...request.source }, targetEnv: request.targetEnv }
  })
  const values: string[] = []
  const metadata: CredentialMetadata[] = []
  try {
    for (const binding of resolvedBindings) {
      let value: string | undefined
      try {
        if (binding.source.kind === 'env') value = readers.readEnv(binding.source.name)
        else {
          if (!readers.readSecret) throw new Error('No resolver')
          value = await readers.readSecret(binding.source.id)
        }
      } catch {
        throw new CredentialError('CREDENTIAL_SOURCE_UNAVAILABLE')
      }
      if (value === undefined || value === '') throw new CredentialError('CREDENTIAL_MISSING')
      if (typeof value !== 'string' || !value.trim() || /[\0\r\n]/.test(value)
        || Buffer.from(value, 'utf8').toString('utf8') !== value) {
        throw new CredentialError('CREDENTIAL_VALUE_INVALID')
      }
      values.push(value)
      metadata.push({ ...binding, presentFingerprint: 'nonempty' })
    }
    return new OneShotLease(metadata, values)
  } catch (error: unknown) {
    values.fill('')
    values.length = 0
    throw error
  }
}
