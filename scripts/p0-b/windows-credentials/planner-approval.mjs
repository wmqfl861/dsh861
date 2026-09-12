/** Signed, exact-request, single-attempt owner decisions; never an API-key store. */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { lstat, open } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

const DOMAIN = 'dsh861/P0-B/planner-owner-decision/v1\n'
const DIGEST = /^[a-f0-9]{64}$/
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RECORD = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value)

/** Fixed error codes contain neither parsed records nor underlying file errors. */
export class PlannerApprovalError extends Error {
  /** @param {string} code - stable refusal identifier. */
  constructor(code) { super(code); this.name = 'PlannerApprovalError'; this.code = code }
}
const refuse = code => { throw new PlannerApprovalError(code) }
const exact = (value, fields) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field))

function decision(value) {
  const fields = ['version', 'purpose', 'ownerId', 'approvalId', 'requestSha256', 'approved', 'maxAttempts',
    'notBefore', 'expiresAt', 'rotationConfirmed', 'rotationRecord', 'transportRecord', 'budget']
  if (!exact(value, fields) || value.version !== 1 || value.purpose !== 'P0-B-CODEX-PLAN'
    || value.approved !== true || value.maxAttempts !== 1 || value.rotationConfirmed !== true
    || !matches(value.ownerId, ID) || !matches(value.approvalId, ID) || !matches(value.requestSha256, DIGEST)
    || !matches(value.rotationRecord, RECORD) || !matches(value.transportRecord, RECORD)
    || !Number.isSafeInteger(value.notBefore) || !Number.isSafeInteger(value.expiresAt)
    || value.notBefore < 0 || value.expiresAt <= value.notBefore
    || !exact(value.budget, ['currency', 'limitMinorUnits', 'enforcementRecord'])
    || !matches(value.budget.currency, /^[A-Z]{3}$/) || !matches(value.budget.enforcementRecord, RECORD)
    || !Number.isSafeInteger(value.budget.limitMinorUnits) || value.budget.limitMinorUnits <= 0) {
    refuse('PLANNER_DECISION_INVALID')
  }
  return Object.freeze({ version: 1, purpose: 'P0-B-CODEX-PLAN', ownerId: value.ownerId,
    approvalId: value.approvalId, requestSha256: value.requestSha256, approved: true, maxAttempts: 1,
    notBefore: value.notBefore, expiresAt: value.expiresAt, rotationConfirmed: true,
    rotationRecord: value.rotationRecord, transportRecord: value.transportRecord,
    budget: Object.freeze({ currency: value.budget.currency, limitMinorUnits: value.budget.limitMinorUnits,
      enforcementRecord: value.budget.enforcementRecord }) })
}

/**
 * Produce the exact canonical payload a separate trusted owner UI may sign.
 * This performs no signing and issues no approval by itself.
 * @param {unknown} value - complete affirmative owner decision.
 * @returns {string} canonical JSON payload, without a trailing newline.
 */
export function plannerDecisionPayload(value) { return JSON.stringify(decision(value)) }

/**
 * Domain-separated bytes for Ed25519 signing/verification with Node crypto.
 * @param {string} payload - canonical payload returned by plannerDecisionPayload.
 * @returns {Buffer} bytes to sign; never a credential value.
 */
export function plannerDecisionSigningBytes(payload) { return Buffer.from(DOMAIN + payload, 'utf8') }

/**
 * Verify against an out-of-band owner key and consume attempts in a protected local ledger.
 * The service must protect the public-key binding and ledger parents/ACL, and must not
 * take either from a submitted envelope. No network/shared-filesystem guarantees are made.
 * @param {{ownerId:string, publicKeyPem:string, spentDirectory:string, maxValidityMs:number}} policy - trusted deployment.
 * @returns {{inspect:Function, consume:Function}} verifier and atomic single-attempt consumer.
 */
export function createPlannerApprovalVerifier(policy) {
  const { ownerId, publicKeyPem, spentDirectory, maxValidityMs } = policy
  if (!matches(ownerId, ID) || !isAbsolute(spentDirectory) || /^[\\/]{2}/.test(spentDirectory)
    || !Number.isSafeInteger(maxValidityMs) || maxValidityMs < 1) refuse('PLANNER_AUTHORITY_INVALID')
  let key
  try { key = createPublicKey(publicKeyPem) } catch { refuse('PLANNER_AUTHORITY_INVALID') }
  if (key.asymmetricKeyType !== 'ed25519') refuse('PLANNER_AUTHORITY_INVALID')
  const inspect = (envelope, requestSha256) => {
    if (!matches(requestSha256, DIGEST) || !exact(envelope, ['payload', 'signature'])
      || typeof envelope.payload !== 'string' || Buffer.byteLength(envelope.payload, 'utf8') > 16384
      || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) {
      refuse('PLANNER_SIGNATURE_INVALID')
    }
    const signature = Buffer.from(envelope.signature, 'base64url')
    if (signature.length !== 64 || signature.toString('base64url') !== envelope.signature
      || !verify(null, plannerDecisionSigningBytes(envelope.payload), key, signature)) refuse('PLANNER_SIGNATURE_INVALID')
    let value
    try { value = JSON.parse(envelope.payload) } catch { refuse('PLANNER_DECISION_INVALID') }
    const claims = decision(value)
    if (JSON.stringify(claims) !== envelope.payload) refuse('PLANNER_DECISION_INVALID')
    if (claims.ownerId !== ownerId || claims.requestSha256 !== requestSha256) refuse('PLANNER_DECISION_MISMATCH')
    const now = Date.now()
    if (claims.expiresAt - claims.notBefore > maxValidityMs
      || now < claims.notBefore || now >= claims.expiresAt) refuse('PLANNER_DECISION_EXPIRED')
    return claims
  }
  const consume = async (envelope, requestSha256) => {
    const claims = inspect(envelope, requestSha256)
    // Existing links and incomplete markers are refused, not repaired or deleted.
    let directory
    try { directory = await lstat(spentDirectory) } catch { refuse('PLANNER_APPROVAL_LEDGER_UNAVAILABLE') }
    if (!directory.isDirectory() || directory.isSymbolicLink()) refuse('PLANNER_APPROVAL_LEDGER_UNAVAILABLE')
    const name = createHash('sha256').update(ownerId + '\0' + claims.approvalId).digest('hex') + '.spent'
    let handle
    try { handle = await open(join(spentDirectory, name), 'wx', 0o600) }
    catch (error) { refuse(error.code === 'EEXIST' ? 'PLANNER_APPROVAL_USED' : 'PLANNER_APPROVAL_LEDGER_UNAVAILABLE') }
    try {
      // A failed write/sync consumes the ID conservatively. Never unlink to permit retry.
      await handle.writeFile(JSON.stringify({ version: 1, ownerId, approvalId: claims.approvalId,
        requestSha256, consumedAt: Date.now() }) + '\n')
      await handle.sync()
    } catch { refuse('PLANNER_APPROVAL_LEDGER_UNAVAILABLE') }
    finally { await handle.close().catch(() => { refuse('PLANNER_APPROVAL_LEDGER_UNAVAILABLE') }) }
    inspect(envelope, requestSha256)
    return claims
  }
  return Object.freeze({ inspect, consume })
}
