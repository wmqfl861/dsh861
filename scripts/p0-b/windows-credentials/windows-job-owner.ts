import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash } from 'node:crypto'
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
  sha256: { executable: string; helper: string }
  environment: Readonly<{ SystemRoot: string; TEMP: string; TMP: string }>
  replyTimeoutMs: number
}

/** Ownership operations over the helper's single job; every method fails closed. */
export interface ProcessJobOwner {
  /** Join the exact PID into the owned job; false means containment was not established. */
  assign(pid: number): Promise<boolean>
  /** Terminate every member of the owned job; false means termination was not confirmed. */
  terminateOwned(): Promise<boolean>
  /** Number of live members, or -1 when the count could not be obtained. */
  activeProcesses(): Promise<number>
  /** Close the job handle, terminating all members; resolves when the helper is gone. */
  dispose(): Promise<void>
}

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
  resolve: (reply: HelperReply) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

async function checkedFile(path: string, expectedSha256: string): Promise<void> {
  if (!isAbsolute(path) || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
  const bytes = await readFile(path)
  if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
}

/**
 * Start the job helper and verify its protocol with one status exchange.
 * @param spec - exact PowerShell executable, owned helper directory, hashes,
 *   environment and per-reply deadline; ambient credentials are not inherited.
 * @returns the single-invocation owner; disposal always terminates members.
 */
export async function createProcessJobOwner(spec: ProcessJobOwnerSpec): Promise<ProcessJobOwner> {
  if (process.platform !== 'win32' || !isAbsolute(spec.directory)
    || !Number.isSafeInteger(spec.replyTimeoutMs) || spec.replyTimeoutMs < 1
    || spec.replyTimeoutMs > 2147483647) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
  for (const value of [spec.environment.SystemRoot, spec.environment.TEMP, spec.environment.TMP]) {
    if (!isAbsolute(value) || /[\0\r\n]/.test(value)) throw new ProcessJobOwnerError('OWNER_HELPER_INVALID')
  }
  await checkedFile(spec.powershellExecutable, spec.sha256.executable)
  const directory = await realpath(spec.directory)
  await checkedFile(join(directory, 'job-owner.ps1'), spec.sha256.helper)

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(spec.powershellExecutable,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', join(directory, 'job-owner.ps1')], {
        cwd: directory, windowsHide: true, shell: false,
        env: { SystemRoot: spec.environment.SystemRoot, TEMP: spec.environment.TEMP, TMP: spec.environment.TMP },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
  } catch {
    throw new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')
  }
  const pending = new Map<number, PendingReply>()
  let sequence = 0
  let disposed = false
  const fail = (error: ProcessJobOwnerError): void => {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    disposed = true
    child.kill()
    child.stdin.destroy()
    child.stdout.destroy()
    child.stderr.destroy()
  }
  child.on('error', () => { fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')) })
  child.stdin.on('error', () => { fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED')) })
  child.stdout.on('error', () => { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')) })
  child.on('close', () => { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')) })
  let buffer = ''
  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line.length === 0) continue
      let reply: HelperReply
      try { reply = JSON.parse(line) as HelperReply } catch { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')); return }
      // The helper answers one request per line in order; match the oldest wait.
      const oldest = pending.entries().next()
      if (oldest.done) { fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')); return }
      clearTimeout(oldest.value[1].timer)
      pending.delete(oldest.value[0])
      oldest.value[1].resolve(reply)
    }
  })
  child.stderr.on('data', (chunk: Buffer) => {
    // Helper diagnostics are never surfaced; the protocol itself reports failures.
    void chunk
    fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
  })

  const request = async (operation: string, extra?: Record<string, unknown>): Promise<HelperReply> => {
    if (disposed) throw new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')
    return await new Promise<HelperReply>((resolve, reject) => {
      const current = ++sequence
      const timer = setTimeout(() => {
        pending.delete(current)
        fail(new ProcessJobOwnerError('OWNER_REPLY_TIMEOUT'))
        reject(new ProcessJobOwnerError('OWNER_REPLY_TIMEOUT'))
      }, spec.replyTimeoutMs)
      pending.set(current, { resolve, reject, timer })
      try {
        child.stdin.write(`${JSON.stringify({ op: operation, ...extra })}\n`, (error) => {
          if (error) {
            clearTimeout(timer)
            pending.delete(current)
            fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED'))
            reject(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED'))
          }
        })
      } catch {
        clearTimeout(timer)
        pending.delete(current)
        fail(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED'))
        reject(new ProcessJobOwnerError('OWNER_HELPER_START_FAILED'))
      }
    })
  }

  const handshake = await request('status')
  if (!handshake.ok || handshake.created !== false || handshake.active !== 0) {
    fail(new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID'))
    throw new ProcessJobOwnerError('OWNER_PROTOCOL_INVALID')
  }
  return {
    async assign(pid: number): Promise<boolean> {
      if (!Number.isSafeInteger(pid) || pid <= 0) return false
      try { return (await request('assign', { pid })).assigned === true }
      catch { return false }
    },
    async terminateOwned(): Promise<boolean> {
      try { return (await request('terminate')).terminated === true }
      catch { return false }
    },
    async activeProcesses(): Promise<number> {
      try {
        const reply = await request('status')
        return reply.ok && Number.isSafeInteger(reply.active) ? (reply.active as number) : -1
      } catch { return -1 }
    },
    async dispose(): Promise<void> {
      if (disposed) return
      try { await request('dispose') } catch { /* the fail path already killed the helper */ }
      disposed = true
      try { child.stdin.end() } catch { /* already closed */ }
    },
  }
}
