import { StringDecoder } from 'node:string_decoder'

/** Fixed replacement; secrets and their hashes never appear in diagnostics. */
export const SECRET_REPLACEMENT = '[SECRET_REDACTED]'

/** Caller-selected bounds; validation rejects oversized credentials instead of truncating. */
export interface RedactionLimits {
  maxSecrets: number
  maxSecretBytes: number
}

type Interval = [start: number, end: number]

/** Known value representations supported by this UTF-8 collector, not arbitrary encodings. */
function variants(value: string): string[] {
  const encoded = encodeURIComponent(value)
  return [...new Set([
    value, JSON.stringify(value).slice(1, -1), encoded,
    encoded.replace(/%[0-9A-F]{2}/g, part => part.toLowerCase()),
    new URLSearchParams({ v: value }).toString().slice(2),
    Buffer.from(value).toString('base64'), Buffer.from(value).toString('base64url'),
  ])]
}

/**
 * Incremental UTF-8 redaction with delayed prefixes and overlapping-match coverage.
 * Each OS output channel needs its own instance. This is not an OS sandbox or a
 * guarantee against unknown secrets, arbitrary transforms, or information side channels.
 */
export class SecretRedactor {
  #decoder = new StringDecoder('utf8')
  #patterns: string[]
  #longest: number
  #pending = ''
  #intervals: Interval[] = []
  #redacting = false
  #detected = false
  #closed = false
  #onDetection: (() => void) | undefined

  constructor(values: readonly string[], limits: RedactionLimits, onDetection?: () => void) {
    if (!Number.isSafeInteger(limits.maxSecrets) || limits.maxSecrets < 1
      || !Number.isSafeInteger(limits.maxSecretBytes) || limits.maxSecretBytes < 1
      || !Array.isArray(values) || values.length === 0 || values.length > limits.maxSecrets) {
      throw new Error('REDACTION_CONFIGURATION_INVALID')
    }
    if (values.some(value => typeof value !== 'string' || value.length === 0
      || Buffer.byteLength(value) > limits.maxSecretBytes
      || Buffer.from(value, 'utf8').toString('utf8') !== value
      || SECRET_REPLACEMENT.includes(value))) throw new Error('REDACTION_CONFIGURATION_INVALID')
    this.#patterns = [...new Set(values.flatMap(variants))]
    this.#longest = Math.max(...this.#patterns.map(pattern => pattern.length))
    this.#onDetection = onDetection
  }

  /** Detection remains latched after finish/discard; it must prevent a case PASS. */
  get secretLeakDetected(): boolean { return this.#detected }

  /** Inspect only the pending length, never its raw bytes. */
  get pendingCharacters(): number { return this.#pending.length }

  /** Feed process bytes. Returned text, not the input, is safe to send to a log sink. */
  push(chunk: Uint8Array): string {
    if (this.#closed) throw new Error('REDACTION_STREAM_CLOSED')
    if (!(chunk instanceof Uint8Array)) throw new Error('REDACTION_INPUT_INVALID')
    this.#pending += this.#decoder.write(Buffer.from(chunk))
    return this.#drain(false)
  }

  /** Flush only on normal EOF; interrupted streams should discard buffered raw suffixes. */
  finish(): string {
    if (this.#closed) throw new Error('REDACTION_STREAM_CLOSED')
    this.#pending += this.#decoder.end()
    const result = this.#drain(true)
    this.discard()
    return result
  }

  /** Release references on error/cancel. JavaScript cannot promise physical memory erasure. */
  discard(): void {
    this.#closed = true
    this.#pending = ''
    this.#patterns.fill('')
    this.#patterns.length = 0
    this.#intervals.length = 0
    this.#decoder = new StringDecoder('utf8')
    this.#onDetection = undefined
  }

  #drain(final: boolean): string {
    const intervals: Interval[] = this.#intervals.slice()
    for (const pattern of this.#patterns) {
      for (let start = this.#pending.indexOf(pattern); start !== -1;
        start = this.#pending.indexOf(pattern, start + 1)) {
        intervals.push([start, start + pattern.length])
      }
    }
    if (intervals.length > 0 && !this.#detected) {
      this.#detected = true
      try { this.#onDetection?.() } catch {
        this.discard()
        throw new Error('REDACTION_DETECTION_CALLBACK_FAILED')
      }
    }
    intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const merged: Interval[] = []
    for (const interval of intervals) {
      const previous = merged[merged.length - 1]
      if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1])
      else merged.push([...interval])
    }
    // Do not emit a position until every possible match starting there is knowable.
    let cutoff = final ? this.#pending.length : Math.max(0, this.#pending.length - this.#longest + 1)
    // Avoid splitting a UTF-16 surrogate pair when the result is UTF-8 encoded by the sink.
    const last = this.#pending.charCodeAt(cutoff - 1)
    if (!final && last >= 0xD800 && last <= 0xDBFF) cutoff -= 1
    let output = ''
    let position = 0
    for (const [start, end] of merged) {
      if (start >= cutoff) break
      if (position < start) {
        output += this.#pending.slice(position, start)
        this.#redacting = false
      }
      if (!this.#redacting) output += SECRET_REPLACEMENT
      this.#redacting = true
      position = Math.min(end, cutoff)
    }
    if (position < cutoff) {
      output += this.#pending.slice(position, cutoff)
      this.#redacting = false
    }
    this.#pending = this.#pending.slice(cutoff)
    this.#intervals = merged.filter(([, end]) => end > cutoff)
      .map(([start, end]) => [Math.max(0, start - cutoff), end - cutoff])
    return output
  }
}
