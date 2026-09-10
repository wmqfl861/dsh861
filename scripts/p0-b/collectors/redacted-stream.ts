import { createHash } from 'node:crypto'
import { open, realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { Transform, type Readable, type TransformCallback } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { SecretRedactor, type RedactionLimits } from '../redaction.ts'

/** Fixed per-run filenames: no caller-controlled traversal or log overwrite. */
export type OutputChannel = 'stdout' | 'stderr'

export interface CaptureConfig extends RedactionLimits {
  /** Already-owned, trusted run directory; securing its parent is the run owner's duty. */
  runRoot: string
  channel: OutputChannel
  /** Limit applies to sanitized UTF-8 bytes written by this channel. */
  maxOutputBytes: number
}

/** A capture result is not a product or node acceptance verdict. */
export interface CaptureReport {
  status: 'CAPTURED' | 'FAIL'
  failureClass: 'SECRET_LEAK_DETECTED' | null
  secretLeakDetected: boolean
  file: string
  bytes: number
  redactedSha256: string
}

export class CaptureError extends Error {
  constructor(
    readonly failureClass: 'CAPTURE_CONFIGURATION_INVALID' | 'CAPTURE_OPEN_FAILED'
      | 'CAPTURE_IO_FAILED' | 'CAPTURE_OUTPUT_LIMIT' | 'SECRET_LEAK_DETECTED',
    readonly secretLeakDetected: boolean = false,
  ) {
    super(failureClass)
    this.name = 'CaptureError'
  }
}

/**
 * Persist only redacted bytes, with pipeline backpressure, private new files and
 * hashes of the redacted stream. Interrupted raw suffixes are discarded, not flushed.
 * onSecretDetected may request managed cancellation; capture does not own processes.
 */
export async function captureRedactedStream(
  source: Readable,
  config: CaptureConfig,
  credentialValues: readonly string[],
  onSecretDetected?: () => void,
): Promise<CaptureReport> {
  if (!isAbsolute(config.runRoot) || !['stdout', 'stderr'].includes(config.channel)
    || !Number.isSafeInteger(config.maxOutputBytes) || config.maxOutputBytes < 1) {
    throw new CaptureError('CAPTURE_CONFIGURATION_INVALID')
  }
  const { runRoot, channel, maxOutputBytes } = config
  const redactor = new SecretRedactor(credentialValues, config, onSecretDetected)
  const file = `${channel}.redacted.log`
  let destination
  try {
    const root = await realpath(runRoot)
    destination = await open(join(root, file), 'wx', 0o600)
  } catch {
    redactor.discard()
    throw new CaptureError('CAPTURE_OPEN_FAILED')
  }
  const hash = createHash('sha256')
  let bytes = 0
  let outputLimit = false as boolean
  const filter = new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      try { accept(redactor.push(chunk)); callback() } catch { callback(new Error('CAPTURE_FILTER_FAILED')) }
    },
    flush(callback: TransformCallback) {
      try { accept(redactor.finish()); callback() } catch { callback(new Error('CAPTURE_FILTER_FAILED')) }
    },
  })
  function accept(text: string): void {
    if (!text) return
    const buffer = Buffer.from(text, 'utf8')
    if (bytes + buffer.length > maxOutputBytes) {
      outputLimit = true
      throw new Error('CAPTURE_OUTPUT_LIMIT')
    }
    bytes += buffer.length
    hash.update(buffer)
    filter.push(buffer)
  }
  try {
    await pipeline(source, filter, destination.createWriteStream())
    return {
      status: redactor.secretLeakDetected ? 'FAIL' : 'CAPTURED',
      failureClass: redactor.secretLeakDetected ? 'SECRET_LEAK_DETECTED' : null,
      secretLeakDetected: redactor.secretLeakDetected,
      file,
      bytes,
      redactedSha256: hash.digest('hex'),
    }
  } catch {
    throw new CaptureError(redactor.secretLeakDetected ? 'SECRET_LEAK_DETECTED'
      : outputLimit ? 'CAPTURE_OUTPUT_LIMIT' : 'CAPTURE_IO_FAILED', redactor.secretLeakDetected)
  } finally {
    redactor.discard()
    await destination.close().catch(() => {})
  }
}
