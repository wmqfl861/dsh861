/** Offline desired-model configuration checks. No credentials, network or native CLI access. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const AGENT_NAMES = Object.freeze(['codex', 'claude-code', 'grok', 'opencode'])
const own = (value, key) => Object.hasOwn(value, key)
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const fields = (value, names) => record(value) && Object.keys(value).length === names.length
  && names.every(name => own(value, name))
const fail = code => { throw new Error(code) }
const safeIdentifier = value => typeof value === 'string'
  && /^[A-Za-z][A-Za-z0-9._/-]{0,127}$/.test(value)
  && !/sk-[A-Za-z0-9_-]{16,}|[a-f0-9]{32}\.[A-Za-z0-9]{8,}/i.test(value)

/**
 * Validate a JSON/file boundary against the secret-free v1 declaration contract.
 * Unknown fields (including apiKey/auth/headers) are rejected, not silently redacted.
 * Effort is the owner's requested value, NOT a claim of native CLI support.
 * @param {unknown} value - parsed declaration.
 * @returns {void}
 */
export function validateModelConfig(value) {
  if (!fields(value, ['schemaVersion', 'configurationVersion', 'credentialPolicy', 'upgradePolicy', 'agents'])
    || value.schemaVersion !== 'dsh861.agent-models.v1'
    || typeof value.configurationVersion !== 'string'
    || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(value.configurationVersion)) fail('MODEL_CONFIG_INVALID')
  const c = value.credentialPolicy
  if (!fields(c, ['storage', 'allowValuesInRepository', 'allowGlobalHarnessImport'])
    || c.storage !== 'external-secret-reference' || c.allowValuesInRepository !== false
    || c.allowGlobalHarnessImport !== false) fail('MODEL_CREDENTIAL_POLICY_INVALID')
  const p = value.upgradePolicy
  const requiredTrue = ['independentOfCliVersion', 'pinForWorkflow', 'requireCompatibilityVerification']
  const requiredFalse = ['allowImplicitModelFallback', 'allowImplicitReasoningFallback',
    'allowImplicitEndpointChange', 'allowUnapprovedAuxiliaryModels']
  if (!fields(p, [...requiredTrue, ...requiredFalse, 'onIncompatible'])
    || requiredTrue.some(name => p[name] !== true) || requiredFalse.some(name => p[name] !== false)
    || p.onIncompatible !== 'retain-previous-or-block') fail('MODEL_UPGRADE_POLICY_INVALID')
  if (!fields(value.agents, AGENT_NAMES)) fail('MODEL_AGENTS_INVALID')
  for (const name of AGENT_NAMES) {
    const a = value.agents[name]
    if (!fields(a, ['provider', 'providerMode', 'baseUrl', 'model', 'reasoningEffort', 'credentialRef'])
      || !safeIdentifier(a.provider) || !safeIdentifier(a.model) || !safeIdentifier(a.reasoningEffort)
      || a.credentialRef !== `secret-reference:providers/${name}`) fail('MODEL_ROUTE_INVALID')
    if (name === 'opencode') {
      if (a.providerMode !== 'builtin-provider' || a.provider !== 'zhipuai-coding-plan'
        || a.baseUrl !== null) fail('MODEL_BUILTIN_PROVIDER_INVALID')
    } else {
      if (a.providerMode !== 'custom-gateway' || typeof a.baseUrl !== 'string'
        || /[\s\\\x00-\x1f]/.test(a.baseUrl)) fail('MODEL_ENDPOINT_INVALID')
      let url
      try { url = new URL(a.baseUrl) } catch { fail('MODEL_ENDPOINT_INVALID') }
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password
        || a.baseUrl.includes('?') || a.baseUrl.includes('#')
        || /sk-[A-Za-z0-9_-]{16,}|[a-f0-9]{32}\.[A-Za-z0-9]{8,}/i.test(a.baseUrl)) fail('MODEL_ENDPOINT_INVALID')
    }
  }
}

// This local format is explicitly versioned; it is not an RFC 8785 implementation.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

/** Hash validated PUBLIC configuration only; never a secret or a credential-derived digest. */
export function publicConfigDigest(value) {
  validateModelConfig(value)
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex')
}

/**
 * Compare with a trusted, previously approved public lock. A lock is an integrity
 * check, not proof of authorization: changing both files can change the baseline.
 */
export function verifyModelConfigLock(value, lock) {
  validateModelConfig(value)
  if (!fields(lock, ['schemaVersion', 'configurationVersion', 'algorithm', 'publicConfigSha256'])
    || lock.schemaVersion !== 'dsh861.agent-models-lock.v1'
    || lock.configurationVersion !== value.configurationVersion
    || lock.algorithm !== 'sha256-sorted-json-v1'
    || typeof lock.publicConfigSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(lock.publicConfigSha256)
    || lock.publicConfigSha256 !== publicConfigDigest(value)) fail('MODEL_CONFIG_LOCK_MISMATCH')
}

/**
 * Refuse a CLI-only upgrade proposal that changes any approved declaration field.
 * Both declarations must satisfy v1. This does not observe a native request or
 * prove provider compatibility; the upgrader must verify those separately.
 */
export function assertUpgradePreservesModelConfig(approved, proposed, trustedLock) {
  verifyModelConfigLock(approved, trustedLock)
  validateModelConfig(proposed)
  if (publicConfigDigest(approved) !== publicConfigDigest(proposed)) fail('MODEL_CONFIG_DRIFT')
}

/** Return a detached, frozen route; adapters must not mutate the approved configuration. */
export function resolveApprovedRoute(value, lock, name) {
  verifyModelConfigLock(value, lock)
  if (!AGENT_NAMES.includes(name)) fail('MODEL_AGENT_UNKNOWN')
  return Object.freeze({ ...value.agents[name] })
}

/** Report explicit non-activation; references never prove that a credential was imported. */
export function configurationReport(value, lock) {
  verifyModelConfigLock(value, lock)
  return {
    status: 'CONFIG_VALID_NOT_ACTIVATED',
    configurationVersion: value.configurationVersion,
    publicConfigSha256: publicConfigDigest(value),
    productAccepted: false,
    nativeCompatibility: 'NOT_RUN',
    credentialProvisioning: 'ROTATE_AND_IMPORT_PRIVATELY_REQUIRED',
    plaintextHttpRoutes: AGENT_NAMES.filter(name => value.agents[name].baseUrl?.startsWith('http://')),
    credentials: AGENT_NAMES.map(name => ({ agent: name, credentialRef: value.agents[name].credentialRef,
      state: 'NOT_IMPORTED_BY_THIS_CHANGE' })),
  }
}

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }
function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const config = readJson(resolve(root, 'config/agents/models.v1.json'))
  const lock = readJson(resolve(root, 'config/agents/models.v1.lock.json'))
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === 'check') {
    console.log(JSON.stringify(configurationReport(config, lock), null, 2))
  } else if (args.length === 3 && args[0] === 'compare-upgrade' && args[1] === '--candidate') {
    assertUpgradePreservesModelConfig(config, readJson(args[2]), lock)
    console.log(JSON.stringify({ status: 'CONFIG_UNCHANGED', nativeCompatibility: 'NOT_RUN', productAccepted: false }))
  } else fail('MODEL_CONFIG_ARGUMENTS_INVALID')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch {
    // Files/arguments can contain secrets: do not log their contents, paths or parser errors.
    console.error('Model configuration check failed: invalid input, lock mismatch or configuration drift.')
    process.exitCode = 1
  }
}
