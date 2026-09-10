import { constants as bufferConstants } from 'node:buffer'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { SecretRedactor, type RedactionLimits } from '../redaction.ts'
import { parseCredentialRef, resolveCredentialReferences, type CredentialBinding } from '../credential-ref.ts'
import { createSealedCredentialReaders, type SealedBridge } from './reader.ts'
import { assertSecretFreeArguments } from '../security-gates.ts'

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
    /** Additional wait after cancellation; not a promise of descendant termination. */
    terminationGraceMs: number
    /** Hard retained UTF-8 byte limit per redacted channel, including EOF flush. */
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
  | 'INPUT_DELIVERY_FAILED'
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
  captureComplete: boolean
  capturedBytes: { stdout: number; stderr: number }
  cleanup: {
    directChildExitObserved: boolean
    stdioCloseObserved: boolean
    forcedPipeClosure: boolean
    descendantState: 'NOT_VERIFIED'
  }
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
  if (approval.subject.baseUrl !== route.baseUrl || /[\u0000-\u0020]/.test(route.baseUrl)) {
    refusal('PLANNER_TRANSPORT_NOT_PROVEN')
  }
  let url: URL
  try { url = new URL(route.baseUrl) } catch { return refusal('PLANNER_TRANSPORT_NOT_PROVEN') }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) {
    refusal('PLANNER_TRANSPORT_NOT_PROVEN')
  }
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
  // The private snapshot is the only specification read across asynchronous work.
  spec = {
    ...spec,
    approval: { ...spec.approval, subject: { ...spec.approval.subject } },
    route: { ...spec.route },
    prompt: { ...spec.prompt },
    cli: { ...spec.cli, args: [...spec.cli.args] },
    process: { ...spec.process, environment: { ...spec.process.environment } },
    redactionLimits: { ...spec.redactionLimits },
  }
  validateApproval(spec.approval)
  validateTransport(spec.approval, spec.route)
  validateSubject(spec.approval, spec.route)
  if (!isAbsolute(spec.prompt.file) || !SHA256.test(spec.prompt.sha256)
    || !isAbsolute(spec.cli.executable) || !SHA256.test(spec.cli.sha256)
    || spec.cli.args.some(argument => argument.includes('\0'))) {
    refusal('PLANNER_SPEC_INVALID')
  }
  validateProcessSpec(spec)
  const promptBytes = await hashedFile(spec.prompt.file, spec.prompt.sha256)
  if (promptBytes === undefined) refusal('PLANNER_INPUT_NOT_FIXED')
  if (await hashedFile(spec.cli.executable, spec.cli.sha256) === undefined) refusal('PLANNER_CLI_NOT_VERIFIED')
  const binding: CredentialBinding = {
    source: parseCredentialRef(spec.route.credentialRef),
    targetEnv: spec.process.credentialEnvironmentVariable,
  }
  const readers = createSealedCredentialReaders(spec.bridge, ['providers/codex'])
  const lease = await resolveCredentialReferences([binding], [binding], readers)
  return lease.use((environment, redactionValues) => {
    assertSecretFreeArguments([spec.cli.executable, ...spec.cli.args], redactionValues, spec.redactionLimits)
    return runPinnedProcess(spec, promptBytes, environment, redactionValues)
  })
}

function validateProcessSpec(spec: PlannerInvocationSpec): void {
  const bound = spec.process
  if (!isAbsolute(bound.workingDirectory)
    || !Number.isSafeInteger(bound.deadlineMs) || bound.deadlineMs < 1 || bound.deadlineMs > 2147483647
    || !Number.isSafeInteger(bound.terminationGraceMs) || bound.terminationGraceMs < 1
    || bound.terminationGraceMs > 2147483647
    || !Number.isSafeInteger(bound.maxChannelBytes) || bound.maxChannelBytes < 1
    || bound.maxChannelBytes > bufferConstants.MAX_STRING_LENGTH
    || !Number.isSafeInteger(spec.redactionLimits.maxSecrets) || spec.redactionLimits.maxSecrets < 1
    || !Number.isSafeInteger(spec.redactionLimits.maxSecretBytes) || spec.redactionLimits.maxSecretBytes < 1
    || !/^[A-Z_][A-Z0-9_]{0,127}$/.test(bound.credentialEnvironmentVariable)
    || Object.keys(bound.environment).some(name => name.toUpperCase() === bound.credentialEnvironmentVariable)
    || Object.entries(bound.environment).some(([name, value]) => /[=\0]/.test(name) || value.includes('\0'))) {
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
  let stderrRedactor: SecretRedactor | undefined
  try {
    stderrRedactor = new SecretRedactor(redactionValues, spec.redactionLimits)
    return await collectProcess(spec, promptBytes, environment, stdoutRedactor, stderrRedactor)
  } finally {
    stdoutRedactor.discard()
    stderrRedactor?.discard()
  }
}

/** Retain only accepted redacted fragments; cancellation never waits indefinitely for inherited pipes. */
function collectProcess(
  spec: PlannerInvocationSpec,
  promptBytes: Buffer,
  environment: Readonly<Record<string, string>>,
  stdoutRedactor: SecretRedactor,
  stderrRedactor: SecretRedactor,
): Promise<PlannerInvocationResult> {
  return new Promise<PlannerInvocationResult>((resolve) => {
    const output = { stdout: '', stderr: '' }
    const bytes = { stdout: 0, stderr: 0 }
    let cancellation: PlannerCancellationReason | undefined
    let settled = false
    let exitCode: number | null = null
    let exitSignal: NodeJS.Signals | null = null
    let directChildExitObserved = false
    let stdioCloseObserved = false
    let forcedPipeClosure = false
    let child: ChildProcessWithoutNullStreams | undefined
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined

    const terminate = (signal: NodeJS.Signals): void => {
      // An exited PID must not be signalled again merely because descendants hold a pipe.
      if (!child?.pid || directChildExitObserved) return
      try { child.kill(signal) } catch {
        // Kill failure does not prove termination; the bounded result retains unknown cleanup.
      }
    }
    const cancel = (reason: PlannerCancellationReason): void => {
      if (settled || cancellation !== undefined) return
      cancellation = reason
      stdoutRedactor.discard()
      stderrRedactor.discard()
      if (deadlineTimer !== undefined) clearTimeout(deadlineTimer)
      cleanupTimer = setTimeout(() => {
        if (settled) return
        forcedPipeClosure = true
        terminate('SIGKILL')
        child?.stdin.destroy()
        child?.stdout.destroy()
        child?.stderr.destroy()
        child?.unref()
        finish()
      }, spec.process.terminationGraceMs)
      terminate('SIGTERM')
    }
    const accept = (channel: 'stdout' | 'stderr', text: string): void => {
      if (settled || cancellation !== undefined) return
      const size = Buffer.byteLength(text, 'utf8')
      if (size > spec.process.maxChannelBytes - bytes[channel]) {
        cancel('OUTPUT_BOUND_EXCEEDED')
        return
      }
      output[channel] += text
      bytes[channel] += size
    }
    const finish = (): void => {
      if (settled) return
      if (cancellation === undefined) {
        try {
          accept('stdout', stdoutRedactor.finish())
          if (cancellation === undefined) accept('stderr', stderrRedactor.finish())
        } catch { cancel('STREAM_ERROR') }
      }
      settled = true
      if (deadlineTimer !== undefined) clearTimeout(deadlineTimer)
      if (cleanupTimer !== undefined) clearTimeout(cleanupTimer)
      stdoutRedactor.discard()
      stderrRedactor.discard()
      const completed = cancellation === undefined
      resolve({
        status: completed ? 'PLANNER_INVOCATION_COMPLETED' : 'PLANNER_INVOCATION_CANCELLED',
        ...(completed ? {} : { cancellationReason: cancellation as PlannerCancellationReason }),
        exitCode: completed ? exitCode : null,
        signal: exitSignal,
        redactedStdout: output.stdout,
        redactedStderr: output.stderr,
        secretLeakDetected: stdoutRedactor.secretLeakDetected || stderrRedactor.secretLeakDetected,
        captureComplete: completed && stdioCloseObserved,
        capturedBytes: { ...bytes },
        cleanup: { directChildExitObserved, stdioCloseObserved, forcedPipeClosure,
          descendantState: 'NOT_VERIFIED' },
        costModel: 'wall-clock-and-channel-bounded-not-per-request',
        productAccepted: false,
      })
    }
    try {
      child = spawn(spec.cli.executable, [...spec.cli.args], {
        cwd: spec.process.workingDirectory,
        env: { ...spec.process.environment, ...environment },
        stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true,
      })
    } catch {
      cancellation = 'SPAWN_ERROR'
      finish()
      return
    }
    const processHandle = child
    deadlineTimer = setTimeout(() => { cancel('DEADLINE_EXCEEDED') }, spec.process.deadlineMs)
    processHandle.on('error', () => {
      cancel('SPAWN_ERROR')
      if (!processHandle.pid) finish()
    })
    processHandle.on('exit', (code, signal) => {
      directChildExitObserved = true
      exitCode = code
      exitSignal = signal
    })
    processHandle.stdout.on('data', (chunk: Buffer) => {
      if (settled || cancellation !== undefined) return
      try { accept('stdout', stdoutRedactor.push(chunk)) } catch { cancel('STREAM_ERROR') }
    })
    processHandle.stderr.on('data', (chunk: Buffer) => {
      if (settled || cancellation !== undefined) return
      try { accept('stderr', stderrRedactor.push(chunk)) } catch { cancel('STREAM_ERROR') }
    })
    processHandle.stdout.on('error', () => { cancel('STREAM_ERROR') })
    processHandle.stderr.on('error', () => { cancel('STREAM_ERROR') })
    processHandle.stdin.on('error', () => { cancel('INPUT_DELIVERY_FAILED') })
    processHandle.on('close', () => { stdioCloseObserved = true; finish() })
    try { processHandle.stdin.end(promptBytes) } catch { cancel('INPUT_DELIVERY_FAILED') }
  })
}
