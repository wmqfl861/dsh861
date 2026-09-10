import { SecretRedactor, type RedactionLimits } from './redaction.ts'

/**
 * Reject known credentials in argv before the caller spawns a process. This does
 * not authorize a command and does not substitute for a shell-free allowlisted launch.
 */
export function assertSecretFreeArguments(
  argv: readonly string[],
  credentialValues: readonly string[],
  limits: RedactionLimits,
): void {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some(value => typeof value !== 'string')) {
    throw new Error('ARGUMENTS_INVALID')
  }
  for (const argument of argv) {
    const redactor = new SecretRedactor(credentialValues, limits)
    try {
      // Inspect the actual argument, not a JSON re-encoding that could hide escapes.
      redactor.push(Buffer.from(argument))
      redactor.finish()
      if (redactor.secretLeakDetected) throw new Error('SECRET_IN_ARGUMENTS')
    } finally { redactor.discard() }
  }
}

/**
 * Minimal output-safety gate. Both channels must be captured, consistent and free
 * of detected secrets. A reported leak takes precedence over missing or malformed
 * companion evidence. Success here is explicitly NOT real-product acceptance.
 * @param reports - untrusted output-capture evidence.
 * @returns the aggregate capture verdict without product acceptance.
 */
export function outputSecurityVerdict(reports: unknown): {
  status: 'OUTPUT_CAPTURED' | 'FAIL' | 'BLOCKED'
  failureClass: 'SECRET_LEAK_DETECTED' | 'OUTPUT_EVIDENCE_INVALID' | null
  productAccepted: false
} {
  if (!Array.isArray(reports)) {
    return { status: 'BLOCKED', failureClass: 'OUTPUT_EVIDENCE_INVALID', productAccepted: false }
  }
  const entries: readonly unknown[] = reports
  const channels = new Set<string>()
  let invalid = entries.length !== 2
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') {
      invalid = true
      continue
    }
    const report = entry as Record<string, unknown>
    if (report.secretLeakDetected === true || report.failureClass === 'SECRET_LEAK_DETECTED') {
      return { status: 'FAIL', failureClass: 'SECRET_LEAK_DETECTED', productAccepted: false }
    }
    if (report.status !== 'CAPTURED' || report.secretLeakDetected !== false || report.failureClass !== null
      || typeof report.file !== 'string'
      || !['stdout.redacted.log', 'stderr.redacted.log'].includes(report.file) || channels.has(report.file)
      || typeof report.bytes !== 'number' || !Number.isSafeInteger(report.bytes) || report.bytes < 0
      || typeof report.redactedSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(report.redactedSha256)) {
      invalid = true
      continue
    }
    channels.add(report.file)
  }
  if (invalid) return { status: 'BLOCKED', failureClass: 'OUTPUT_EVIDENCE_INVALID', productAccepted: false }
  return { status: 'OUTPUT_CAPTURED', failureClass: null, productAccepted: false }
}
