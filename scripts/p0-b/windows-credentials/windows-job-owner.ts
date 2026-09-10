import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

export class ProcessJobOwnerError extends Error {
  constructor(readonly code: 'OWNER_HELPER_INVALID'
    | 'OWNER_HELPER_START_FAILED'
    | 'OWNER_REPLY_TIMEOUT'
    | 'OWNER_PROTOCOL_INVALID') {
    super(code)
    this.name = 'ProcessJobOwnerError'
  }
}

/** Integrity-pinned deployment of the job helper; hashes are approved out of band. */
export interface ProcessJobOwnerSpec {
  powershellExecutable: string
  directory: string
  /** `launcher` pins the gated CLI launcher used for pre-launch containment. */
  sha256: { executable: string; helper: string; launcher: string }
  environment: Readonly<{ SystemRoot: string; TEMP: string; TMP: string }>
  replyTimeoutMs: number
}

/** One CLI start through the pinned gate launcher; no secrets cross this request. */
export interface GateLaunchRequest {
  executable: string
  args: readonly string[]
  workingDirectory: string
  environment: Readonly<Record<string, string>>
  /** Bounded pre-release wait handed to the launcher, derived from the run bounds. */
  maxWaitMs: number
}

/** Ownership operations over the helper's single job; every method fails closed. */
export interface ProcessJobOwner {
  /** Join the exact PID into the owned job; false means containment was not established. */
  assign(pid: number): Promise<boolean>
  /** Request termination of the owned job; true is acknowledgement, not an observed empty job. */
  terminateOwned(): Promise<boolean>
  /** Number of live members, or -1 when the count could not be obtained. */
  activeProcesses(): Promise<number>
  /** Resolve only after a valid dispose reply and observed clean helper close; failures reject. */
  dispose(): Promise<void>
  /**
   * Start the CLI through the pinned gate launcher with the CLI's exact stdio,
   * working directory and environment. The launcher joins the job through
   * assign() and creates the CLI only after releaseGated(), so the CLI's first
   * code runs already inside the owned job; the job admits no breakaway.
   */
  launchGated(request: GateLaunchRequest): ChildProcessWithoutNullStreams
  /** Allow the gated CLI start; call only after assign() confirmed the launcher's membership. */
  releaseGated(): void
  /** End the gate without creating the CLI; safe to call whenever containment was not established. */
  abortGated(): void
}

type Operation = 'assign' | 'terminate' | 'status' | 'dispose'
interface HelperReply {
  ok: boolean
  code?: string
  assigned?: boolean
  terminated?: boolean
  disposed?: boolean
  created?: boolean
  active?: number
}
interface PendingReply {
  operation: Operation
  resolve: (reply: HelperReply) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}
// Protocol messages contain only small control facts, never logs or credentials.
const MAX_REPLY_BYTES = 4096

function replyFor(value: unknown, operation: Operation): HelperReply {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')
  }
  const record = value as Record<string, unknown>
  const exact = (names: string[]): boolean => Object.keys(record).length === names.length
    && names.every(name => Object.hasOwn(record, name))
  if (record.ok === false && exact(['ok', 'code'])
    && typeof record.code === 'string' && /^OWNER_[A-Z_]{1,80}$/.test(record.code)) {
    return { ok: false, code: record.code }
  }
  if (record.ok === true) {
    if (operation === 'status' && exact(['ok', 'created', 'active'])
      && typeof record.created === 'boolean' && typeof record.active === 'number'
      && Number.isSafeInteger(record.active) && record.active >= 0 && record.active <= 2147483647
      && (record.created || record.active === 0)) {
      return { ok: true, created: record.created, active: record.active }
    }
    const field = operation === 'assign' ? 'assigned' : operation === 'terminate' ? 'terminated' : 'disposed'
    if (operation !== 'status' && exact(['ok', field]) && record[field] === true) {
      return { ok: true, [field]: true }
    }
  }
  throw new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')
}

async function checkedFile(path: string, expectedSha256: string): Promise<void> {
  if (!isAbsolute(path) || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
  const bytes = await readFile(path)
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
}

/**
 * Start the job helper and verify its protocol with one status exchange.
 * @param spec - exact PowerShell executable, owned helper directory, hashes,
 *   environment and per-reply/close deadline; ambient credentials are not inherited.
 * @returns the single-invocation owner; protocol failures remain latched through disposal.
 */
export async function createProcessJobOwner(spec: ProcessJobOwnerSpec): Promise<ProcessJobOwner> {
  spec = { ...spec, sha256: { ...spec.sha256 }, environment: { ...spec.environment } }
  if (process.platform !== 'win32' || !isAbsolute(spec.directory)
    || !Number.isSafeInteger(spec.replyTimeoutMs) || spec.replyTimeoutMs < 1
    || spec.replyTimeoutMs > 2147483647) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
  for (const value of [spec.environment.SystemRoot, spec.environment.TEMP, spec.environment.TMP]) {
    if (!isAbsolute(value) || /[\0\r\n]/.test(value)) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
  }
  await checkedFile(spec.powershellExecutable, spec.sha256.executable)
  const directory = await realpath(spec.directory)
  await checkedFile(join(directory, 'job-owner.ps1'), spec.sha256.helper)
  await checkedFile(join(directory, 'launch-gate.mjs'), spec.sha256.launcher)

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(spec.powershellExecutable,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(directory, 'job-owner.ps1')], {
        cwd: directory, windowsHide: true, shell: false,
        env: { SystemRoot: spec.environment.SystemRoot, TEMP: spec.environment.TEMP, TMP: spec.environment.TMP },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
  } catch { throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED') }
  const pending = new Map<number, PendingReply>()
  let sequence = 0
  let failure: ProcessJobOwnerError | undefined
  let exited = false
  let closed = false
  let disposing = false
  let disposeAcknowledged = false
  let disposal: Promise<void> | undefined
  let buffer: Buffer = Buffer.alloc(0)
  let notifyClose: () => void = () => {}
  // One gate per single-invocation owner; `directory` also holds its marker files.
  let gate: { directory: string; goMarker: string; abortMarker: string } | undefined
  const closeObserved = new Promise<void>((resolve) => { notifyClose = resolve })
  const fail = (error: ProcessJobOwnerError): void => {
    if (failure) return
    failure = error
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    buffer = Buffer.alloc(0)
    if (!exited && !closed) {
      try { child.kill() } catch { /* a signal request is not an exit observation */ }
    }
    child.stdin.destroy()
    child.stdout.destroy()
    child.stderr.destroy()
    child.unref()
  }
  child.on('error', () => { fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')) })
  child.stdin.on('error', () => { fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')) })
  child.stdout.on('error', () => { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')) })
  child.stderr.on('error', () => { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')) })
  child.on('exit', () => { exited = true })
  child.on('close', (code, signal) => {
    closed = true
    if (!disposing || !disposeAcknowledged || code !== 0 || signal !== null || buffer.length > 0 || pending.size > 0) {
      fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
    }
    notifyClose()
  })
  child.stdout.on('data', (chunk: Buffer) => {
    if (failure || closed) return
    let offset = 0
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset)
      const end = newline < 0 ? chunk.length : newline
      if (buffer.length + end - offset > MAX_REPLY_BYTES) {
        fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
        return
      }
      buffer = Buffer.concat([buffer, chunk.subarray(offset, end)])
      if (newline < 0) return
      const text = buffer.toString('utf8')
      const validEncoding = Buffer.from(text).equals(buffer)
      buffer = Buffer.alloc(0)
      const oldest = pending.entries().next()
      if (!validEncoding || oldest.done) { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')); return }
      let reply: HelperReply
      try { reply = replyFor(JSON.parse(text), oldest.value[1].operation) }
      catch { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')); return }
      clearTimeout(oldest.value[1].timer)
      pending.delete(oldest.value[0])
      if (oldest.value[1].operation === 'dispose' && reply.ok && reply.disposed) disposeAcknowledged = true
      oldest.value[1].resolve(reply)
      offset = newline + 1
    }
  })
  child.stderr.on('data', () => { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')) })

  const request = (operation: Operation, extra?: Record<string, unknown>): Promise<HelperReply> => {
    if (failure || closed || (disposing && operation !== 'dispose')) {
      return Promise.reject(failure ?? new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
    }
    return new Promise<HelperReply>((resolve, reject) => {
      const current = ++sequence
      const timer = setTimeout(() => { fail(new ProcessJobOwnerError('OWNER_REPLY_TIMEOUT')) }, spec.replyTimeoutMs)
      pending.set(current, { operation, resolve, reject, timer })
      try {
        child.stdin.write(`${JSON.stringify({ op: operation, ...extra })}\n`, (error) => {
          if (error) fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED'))
        })
      } catch { fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')) }
    })
  }

  const handshake = await request('status')
  if (!handshake.ok || handshake.created !== false || handshake.active !== 0) {
    fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
    throw failure as ProcessJobOwnerError
  }
  return {
    async assign(pid: number): Promise<boolean> {
      if (!Number.isSafeInteger(pid) || pid <= 0) return false
      try { const reply = await request('assign', { pid }); return reply.ok && reply.assigned === true }
      catch { return false }
    },
    async terminateOwned(): Promise<boolean> {
      try { const reply = await request('terminate'); return reply.ok && reply.terminated === true }
      catch { return false }
    },
    async activeProcesses(): Promise<number> {
      try { const reply = await request('status'); return reply.ok ? (reply.active as number) : -1 }
      catch { return -1 }
    },
    dispose(): Promise<void> {
      if (disposal) return disposal
      disposing = true
      disposal = (async () => {
        const reply = await request('dispose')
        if (!reply.ok || !reply.disposed) {
          fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
          throw failure as ProcessJobOwnerError
        }
        try { child.stdin.end() } catch { fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')) }
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([closeObserved, new Promise<void>((_resolve, reject) => {
            timer = setTimeout(() => {
              const timeout = new ProcessJobOwnerError('OWNER_REPLY_TIMEOUT')
              fail(timeout)
              reject(timeout)
            }, spec.replyTimeoutMs)
          })])
        } finally { if (timer !== undefined) clearTimeout(timer) }
        if (failure) throw failure
        if (gate) {
          try { rmSync(gate.directory, { recursive: true, force: true }) }
          catch { /* bounded marker residue under the run's TEMP */ }
        }
      })()
      return disposal
    },
    launchGated(request: GateLaunchRequest): ChildProcessWithoutNullStreams {
      if (gate) throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')
      let gateDirectory: string
      try { gateDirectory = mkdtempSync(join(spec.environment.TEMP, 'dsh861-launch-gate-')) }
      catch { throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED') }
      const specFile = join(gateDirectory, 'launch.json')
      const goMarker = join(gateDirectory, 'go')
      const abortMarker = join(gateDirectory, 'abort')
      try {
        // No secrets cross this file: only the pinned executable path, argv and cwd.
        writeFileSync(specFile, `${JSON.stringify({ executable: request.executable, args: [...request.args], cwd: request.workingDirectory })}\n`)
      } catch { throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED') }
      let launcher: ChildProcessWithoutNullStreams
      try {
        launcher = spawn(process.execPath,
          [join(directory, 'launch-gate.mjs'), specFile, goMarker, abortMarker, String(request.maxWaitMs)], {
            cwd: request.workingDirectory, env: { ...request.environment },
            stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true,
          })
      } catch { throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED') }
      gate = { directory: gateDirectory, goMarker, abortMarker }
      return launcher
    },
    releaseGated(): void {
      if (!gate) throw new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')
      try { writeFileSync(gate.goMarker, '') } catch { throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED') }
    },
    abortGated(): void {
      if (!gate) return
      try { writeFileSync(gate.abortMarker, '') } catch { /* job termination and the direct kill still end the launcher */ }
    },
  }
}
