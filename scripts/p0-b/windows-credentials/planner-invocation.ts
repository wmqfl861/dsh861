import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { SecretRedactor, type RedactionLimits } from '../redaction.ts'
import { parseCredentialRef, resolveCredentialReferences, type CredentialBinding } from '../credential-ref.ts'
import { createSealedCredentialReaders, type SealedBridge } from './reader.ts'

/**
 * Owner-issued single-call authorization, passed in by the trusted caller.
 * The wrapper never constructs, widens, or self-issues one; a credential
 * existing in the store is not execution authorization.
 */
export interface PlannerApproval {
  /** Names the owner authorization record this approval was copied from. */
  record: string
  /** Names the evidence record proving the approved route's transport protection. */
  transportEvidenceRecord: string
  subject: { agent: 'codex'; model: string; reasoningEffort: string; baseUrl: string }
}

/** The lock-verified route for the single approved agent, from `resolveApprovedRoute`. */
export interface PlannerRoute {
  provider: string
  model: string
  reasoningEffort: string
  baseUrl: string
  credentialRef: string
}

/** Fixed invocation inputs; nothing is derived from model output or untrusted files. */
export interface PlannerInvocationSpec {
  approval: PlannerApproval
  route: PlannerRoute
  prompt: { file: string; sha256: string }
  cli: { executable: string; sha256: string; args: readonly string[] }
  bridge: SealedBridge
  process: {
    workingDirectory: string
    environment: Readonly<Record<string, string>>
    credentialEnvironmentVariable: string
    deadlineMs: number
    maxChannelBytes: number
  }
  redactionLimits: RedactionLimits
}

export type PlannerRefusalCode =
  | 'PLANNER_APPROVAL_INVALID'
  | 'PLANNER_TRANSPORT_NOT_PROVEN'
  | 'PLANNER_SUBJECT_NOT_APPROVED'
  | 'PLANNER_INPUT_NOT_FIXED'
  | 'PLANNER_CLI_NOT_VERIFIED'
  | 'PLANNER_SPEC_INVALID'

/** Fixed refusal code only; causes, credential values, and file content are never attached. */
export class PlannerInvocationError extends Error {
  constructor(readonly code: PlannerRefusalCode) {
    super(code)
    this.name = 'PlannerInvocationError'
  }
}

export type PlannerCancellationReason =
  | 'DEADLINE_EXCEEDED'
  | 'OUTPUT_BOUND_EXCEEDED'
  | 'STREAM_ERROR'
  | 'SPAWN_ERROR'

/** Every reported string channel is already redacted; a detection must block a pass. */
export interface PlannerInvocationResult {
  status: 'PLANNER_INVOCATION_COMPLETED' | 'PLANNER_INVOCATION_CANCELLED'
  cancellationReason?: PlannerCancellationReason
  exitCode: number | null
  signal: NodeJS.Signals | null
  redactedStdout: string
  redactedStderr: string
  secretLeakDetected: boolean
  /** One CLI process may issue several model requests; these bounds are not a per-request cost ceiling. */
  costModel: 'wall-clock-and-channel-bounded-not-per-request'
  productAccepted: false
}

const SHA256 = /^[a-f0-9]{64}$/

function refusal(code: PlannerRefusalCode): never {
  throw new PlannerInvocationError(code)
}

/** Every gate below runs before any credential read. */
function validateApproval(approval: PlannerApproval): void {
  if (approval.record.length < 1 || approval.transportEvidenceRecord.length < 1
    || approval.subject.model.length < 1
    || approval.subject.reasoningEffort.length < 1 || approval.subject.baseUrl.length < 1) {
    refusal('PLANNER_APPROVAL_INVALID')
  }
}

/**
 * Only HTTPS routes run this round. Written HTTP risk acceptance is not transport
 * protection evidence, and no HTTP exception is authorized.
 */
function validateTransport(approval: PlannerApproval, route: PlannerRoute): void {
  if (approval.subject.baseUrl !== route.baseUrl
    || !route.baseUrl.startsWith('https://')) refusal('PLANNER_TRANSPORT_NOT_PROVEN')
}

function validateSubject(approval: PlannerApproval, route: PlannerRoute): void {
  if (route.model !== approval.subject.model
    || route.reasoningEffort !== approval.subject.reasoningEffort
    || route.credentialRef !== 'secret-reference:providers/codex') refusal('PLANNER_SUBJECT_NOT_APPROVED')
}

async function hashedFile(path: string, expectedSha256: string): Promise<Buffer | undefined> {
  try {
    const bytes = await readFile(path)
    return createHash('sha256').update(bytes).digest('hex') === expectedSha256 ? bytes : undefined
  } catch {
    return undefined
  }
}

/**
 * Run one planner CLI invocation after every pre-read gate passes.
 * The credential crosses only into the child environment through the existing
 * one-shot lease; all captured output is redacted before it is returned.
 * @param spec - trusted-caller inputs: approval, lock-verified route, pinned prompt
 *   and CLI, sealed credential bridge, process bounds, redaction limits.
 * @returns a completed or cancelled result whose text channels are already redacted.
 */
export async function invokePlannerOnce(spec: PlannerInvocationSpec): Promise<PlannerInvocationResult> {
  validateApproval(spec.approval)
  validateTransport(spec.approval, spec.route)
  validateSubject(spec.approval, spec.route)
  if (!isAbsolute(spec.prompt.file) || !SHA256.test(spec.prompt.sha256)
    || !isAbsolute(spec.cli.executable) || !SHA256.test(spec.cli.sha256)
    || !Array.isArray(spec.cli.args) || spec.cli.args.some(argument => typeof argument !== 'string')) {
    refusal('PLANNER_SPEC_INVALID')
  }
  const promptBytes = await hashedFile(spec.prompt.file, spec.prompt.sha256)
  if (promptBytes === undefined) refusal('PLANNER_INPUT_NOT_FIXED')
  if (await hashedFile(spec.cli.executable, spec.cli.sha256) === undefined) refusal('PLANNER_CLI_NOT_VERIFIED')
  validateProcessSpec(spec)
  const binding: CredentialBinding = {
    source: parseCredentialRef(spec.route.credentialRef),
    targetEnv: spec.process.credentialEnvironmentVariable,
  }
  const readers = createSealedCredentialReaders(spec.bridge, ['providers/codex'])
  const lease = await resolveCredentialReferences([binding], [binding], readers)
  return lease.use((environment, redactionValues) =>
    runPinnedProcess(spec, promptBytes, environment, redactionValues))
}

function validateProcessSpec(spec: PlannerInvocationSpec): void {
  const bound = spec.process
  if (!isAbsolute(bound.workingDirectory)
    || !Number.isSafeInteger(bound.deadlineMs) || bound.deadlineMs < 1 || bound.deadlineMs > 2147483647
    || !Number.isSafeInteger(bound.maxChannelBytes) || bound.maxChannelBytes < 1
    || !/^[A-Z_][A-Z0-9_]{0,127}$/.test(bound.credentialEnvironmentVariable)
    || Object.hasOwn(bound.environment, bound.credentialEnvironmentVariable)) {
    refusal('PLANNER_SPEC_INVALID')
  }
}

async function runPinnedProcess(
  spec: PlannerInvocationSpec,
  promptBytes: Buffer,
  environment: Readonly<Record<string, string>>,
  redactionValues: readonly string[],
): Promise<PlannerInvocationResult> {
  const stdoutRedactor = new SecretRedactor(redactionValues, spec.redactionLimits)
  const stderrRedactor = new SecretRedactor(redactionValues, spec.redactionLimits)
  return await new Promise<PlannerInvocationResult>((resolve) => {
    let redactedStdout = ''
    let redactedStderr = ''
    let cancellation: PlannerCancellationReason | undefined
    let settled = false
    let closedExitCode: number | null = null
    let closedSignal: NodeJS.Signals | null = null
    const child = spawn(spec.cli.executable, [...spec.cli.args], {
      cwd: spec.process.workingDirectory,
      env: { ...spec.process.environment, ...environment },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    })
    // The deadline terminates the direct child only, not a proven descendant tree.
    const timer = setTimeout(() => {
      cancellation ??= 'DEADLINE_EXCEEDED'
      child.kill()
    }, spec.process.deadlineMs)
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const completed = cancellation === undefined
      if (completed) {
        redactedStdout += stdoutRedactor.finish()
        redactedStderr += stderrRedactor.finish()
      } else {
        stdoutRedactor.discard()
        stderrRedactor.discard()
      }
      resolve({
        status: completed ? 'PLANNER_INVOCATION_COMPLETED' : 'PLANNER_INVOCATION_CANCELLED',
        ...(completed ? {} : { cancellationReason: cancellation as PlannerCancellationReason }),
        exitCode: completed ? closedExitCode : null,
        signal: closedSignal,
        redactedStdout,
        redactedStderr,
        secretLeakDetected: stdoutRedactor.secretLeakDetected || stderrRedactor.secretLeakDetected,
        costModel: 'wall-clock-and-channel-bounded-not-per-request',
        productAccepted: false,
      })
    }
    child.on('error', () => {
      cancellation ??= 'SPAWN_ERROR'
      finish()
    })
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return
      try {
        redactedStdout += stdoutRedactor.push(chunk)
        if (redactedStdout.length > spec.process.maxChannelBytes) {
          cancellation ??= 'OUTPUT_BOUND_EXCEEDED'
          child.kill()
        }
      } catch {
        cancellation ??= 'STREAM_ERROR'
        child.kill()
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (settled) return
      try {
        redactedStderr += stderrRedactor.push(chunk)
        if (redactedStderr.length > spec.process.maxChannelBytes) {
          cancellation ??= 'OUTPUT_BOUND_EXCEEDED'
          child.kill()
        }
      } catch {
        cancellation ??= 'STREAM_ERROR'
        child.kill()
      }
    })
    child.stdout.on('error', () => {
      cancellation ??= 'STREAM_ERROR'
      child.kill()
    })
    child.stderr.on('error', () => {
      cancellation ??= 'STREAM_ERROR'
      child.kill()
    })
    child.on('close', (code, signal) => {
      closedExitCode = code
      closedSignal = signal
      finish()
    })
    child.stdin.on('error', () => { child.stdin.destroy() })
    child.stdin.end(promptBytes)
  })
}
