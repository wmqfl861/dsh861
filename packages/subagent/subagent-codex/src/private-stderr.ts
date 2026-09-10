/**
 * Private native diagnostics at the Codex Provider's process boundary.
 * @module @deepseek-ai/dsh-subagent-codex/private-stderr
 */

import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'

/**
 * Drain and suppress native stderr before handing a child to the one-shot runner.
 *
 * The Provider owns the raw pipe exclusively. Native configuration can contain
 * credentials unknown to the Host, so no stderr bytes, errors, summaries, or
 * value-derived hashes are forwarded. This is deliberate diagnostic loss, not
 * selective secret detection; structured protocol/process diagnostics remain.
 *
 * Drain listeners last until the stream closes, even if process teardown fails.
 * The returned handle delegates process ownership without changing its outcome,
 * cancellation, stdin, stdout, or collected readers. It exposes no stderr pipe.
 * @param child - newly spawned child with a Provider-owned raw stderr pipe.
 * @returns a process handle with private native stderr and unchanged ownership.
 */
export function withPrivateCodexStderr(child: SubprocessHandle): SubprocessHandle {
  const stderr = child.stderr
  if (stderr === undefined) return child

  const discard = (): void => {
    // Consume without decoding, retaining, inspecting, or emitting the payload.
  }
  const discardError = (): void => {
    // Auxiliary diagnostics cannot leak through an unhandled stream error.
  }
  const onClose = (): void => {
    stderr.off('data', discard)
    stderr.off('error', discardError)
    stderr.off('close', onClose)
  }
  if (!stderr.closed) {
    stderr.on('error', discardError)
    stderr.once('close', onClose)
    stderr.on('data', discard)
  }

  return {
    get pid() { return child.pid },
    get stdin() { return child.stdin },
    get stdout() { return child.stdout },
    stderr: undefined,
    get collected() { return child.collected },
    get done() { return child.done },
    terminate: () => { child.terminate() },
    waitForExit: signal => child.waitForExit(signal),
  }
}
