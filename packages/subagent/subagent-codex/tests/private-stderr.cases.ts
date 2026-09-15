import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { PassThrough } from 'node:stream'
import type { SubprocessHandle, SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'

type RegisterTest = (name: string, body: () => void | Promise<void>) => unknown
type Protect = (child: SubprocessHandle) => SubprocessHandle
const tick = async (): Promise<void> => { await new Promise<void>(resolve => setImmediate(resolve)) }

function fixture() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const outcome: SubprocessOutcome = { exitCode: 0, signal: null }
  const handle: SubprocessHandle = {
    stdin, stdout, stderr,
    collected: {},
    done: Promise.resolve(outcome),
    terminate() { assert.equal(this, handle) },
    async waitForExit() { assert.equal(this, handle); return true },
  }
  const cleanup = async (): Promise<void> => {
    stdin.destroy(); stdout.destroy(); stderr.destroy()
    await tick()
  }
  return { handle, stdin, stdout, stderr, outcome, cleanup }
}

/** The same assertions run under repository Vitest and the offline Node fixture. */
export function registerPrivateStderrCases(test: RegisterTest, protect: Protect): void {
  test('leaves a child without a stderr pipe unchanged', async () => {
    const f = fixture()
    try {
      const child = { ...f.handle, stderr: undefined }
      assert.equal(protect(child), child)
    } finally { await f.cleanup() }
  })

  test('does not expose raw stderr or retain split, Unicode, binary and encoded payloads', async () => {
    const f = fixture()
    try {
      const guarded = protect(f.handle)
      assert.equal(guarded.stderr, undefined)
      for (const bytes of [Buffer.from('synthetic private credential'), Buffer.from('保密数据'),
        Buffer.from([0, 0xff, 0xc3]), Buffer.from('c3ludGhldGljLW9ubHk='), Buffer.from('%73%79%6e')]) {
        for (const byte of bytes) f.stderr.write(Buffer.from([byte]))
      }
      f.stderr.emit('data', 'an undecoded string event')
      await tick()
      assert.equal(f.stderr.readableLength, 0)
      assert.equal(guarded.collected.stderr, undefined)
      assert.equal(JSON.stringify(guarded).includes('synthetic private credential'), false)
    } finally { await f.cleanup() }
  })

  test('keeps stdout, stdin, outcome and collected-reader identities unchanged', async () => {
    const f = fixture()
    try {
      const guarded = protect(f.handle)
      assert.equal(guarded.stdin, f.stdin)
      assert.equal(guarded.stdout, f.stdout)
      assert.equal(guarded.done, f.handle.done)
      assert.equal(guarded.collected, f.handle.collected)
      assert.equal(await guarded.done, f.outcome)
      f.stdout.write('protocol-response')
      assert.deepEqual(f.stdout.read(), Buffer.from('protocol-response'))
      f.stdin.write('protocol-request')
      assert.deepEqual(f.stdin.read(), Buffer.from('protocol-request'))
    } finally { await f.cleanup() }
  })

  test('delegates termination and wait with the original receiver and signal', async () => {
    const f = fixture()
    try {
      const signal = new AbortController().signal
      let stopped = 0
      const child = { ...f.handle,
        terminate() { assert.equal(this, child); stopped += 1 },
        async waitForExit(input?: AbortSignal) { assert.equal(this, child); assert.equal(input, signal); return false },
      }
      const guarded = protect(child)
      guarded.terminate()
      assert.equal(stopped, 1)
      assert.equal(await guarded.waitForExit(signal), false)
    } finally { await f.cleanup() }
  })

  test('reads changing owner properties instead of freezing a stale copy', async () => {
    const f = fixture()
    try {
      let collected: SubprocessHandle['collected'] = {}
      const child = { ...f.handle, get collected() { return collected } }
      const guarded = protect(child)
      assert.equal(guarded.collected, collected)
      const replacement: SubprocessHandle['collected'] = {}
      collected = replacement
      assert.equal(guarded.collected, replacement)
    } finally { await f.cleanup() }
  })

  test('contains diagnostic-stream errors without replacing process outcome', async () => {
    const f = fixture()
    try {
      const guarded = protect(f.handle)
      assert.doesNotThrow(() => f.stderr.emit('error', new Error('synthetic unknown private error')))
      assert.equal(await guarded.done, f.outcome)
      assert.equal(guarded.stderr, undefined)
    } finally { await f.cleanup() }
  })

  test('preserves process failures instead of converting them to success', async () => {
    const f = fixture()
    try {
      const failure = new Error('fixture process failure')
      const done = Promise.reject<SubprocessOutcome>(failure)
      const guarded = protect({ ...f.handle, done })
      await assert.rejects(guarded.done, error => error === failure)
    } finally { await f.cleanup() }
  })

  test('continues draining after a teardown failure until the raw pipe actually closes', async () => {
    const f = fixture()
    try {
      const failure = new Error('fixture teardown failure')
      const guarded = protect({ ...f.handle, async waitForExit() { throw failure } })
      await assert.rejects(guarded.waitForExit(), error => error === failure)
      assert.equal(f.stderr.listenerCount('data'), 1)
      f.stderr.write('private data arriving after attempted teardown')
      await tick()
      assert.equal(f.stderr.readableLength, 0)
      f.stderr.destroy()
      await tick()
      assert.equal(f.stderr.listenerCount('data'), 0)
      assert.equal(f.stderr.listenerCount('error'), 0)
    } finally { await f.cleanup() }
  })

  test('releases only its own listeners on close and never destroys other pipes', async () => {
    const f = fixture()
    try {
      const foreign = (): void => {}
      f.stderr.on('error', foreign)
      protect(f.handle)
      f.stderr.destroy()
      await tick()
      assert.deepEqual(f.stderr.listeners('error'), [foreign])
      assert.equal(f.stderr.listenerCount('data'), 0)
      assert.equal(f.stderr.listenerCount('close'), 0)
      assert.equal(f.stdin.destroyed, false)
      assert.equal(f.stdout.destroyed, false)
      f.stderr.off('error', foreign)
    } finally { await f.cleanup() }
  })

  test('does not add duplicate drain listeners when an already-private handle is reused', async () => {
    const f = fixture()
    try {
      const guarded = protect(f.handle)
      assert.equal(protect(guarded), guarded)
      assert.equal(f.stderr.listenerCount('data'), 1)
    } finally { await f.cleanup() }
  })

  test('does not attach listeners to an already closed stream', async () => {
    const f = fixture()
    try {
      f.stderr.destroy()
      await tick()
      assert.equal(f.stderr.closed, true)
      assert.equal(protect(f.handle).stderr, undefined)
      assert.equal(f.stderr.listenerCount('data'), 0)
      assert.equal(f.stderr.listenerCount('error'), 0)
    } finally { await f.cleanup() }
  })

  test('keeps concurrent children and their stdout isolated', async () => {
    const first = fixture(), second = fixture()
    try {
      const a = protect(first.handle), b = protect(second.handle)
      first.stderr.write('first private output'); second.stderr.write('second private output')
      first.stderr.destroy()
      await tick()
      assert.equal(second.stderr.destroyed, false)
      assert.equal(second.stderr.listenerCount('data'), 1)
      assert.equal(a.stdout, first.stdout)
      assert.equal(b.stdout, second.stdout)
      second.stdout.write('second answer')
      assert.deepEqual(b.stdout?.read(), Buffer.from('second answer'))
    } finally { await first.cleanup(); await second.cleanup() }
  })

  for (const exitCode of [0, 7]) {
    test(`real Node child drains a large private stderr stream without blocking (exit ${exitCode})`, async () => {
      const child = spawn(process.execPath, ['-e',
        `process.stderr.write('synthetic-not-a-real-key'.repeat(50000), () => { process.stdout.write('ANSWER', () => { process.exitCode = ${exitCode} }) })`],
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, windowsHide: true })
      const done = new Promise<SubprocessOutcome>((resolve, reject) => {
        child.once('error', reject)
        child.once('close', (code, signal) => { resolve({ exitCode: code, signal }) })
      })
      const handle: SubprocessHandle = {
        stdin: child.stdin, stdout: child.stdout, stderr: child.stderr,
        collected: {}, done,
        terminate() { child.kill() },
        async waitForExit() { await done; return true },
      }
      const guarded = protect(handle)
      let output = ''
      guarded.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
      try {
        assert.equal(guarded.stderr, undefined)
        assert.deepEqual(await guarded.done, { exitCode, signal: null })
        assert.equal(output, 'ANSWER')
        assert.equal(child.stderr.listenerCount('data'), 0)
        assert.equal(child.stderr.listenerCount('error'), 0)
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill()
        await done.catch(() => {})
      }
    })
  }

  test('delegated cancellation still stops a real fixture process', async () => {
    const child = spawn(process.execPath, ['-e',
      "process.stdout.write('READY'); setInterval(() => process.stderr.write('synthetic private tick'), 5)"],
    { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, windowsHide: true })
    const done = new Promise<SubprocessOutcome>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (exitCode, signal) => { resolve({ exitCode, signal }) })
    })
    const guarded = protect({
      stdin: child.stdin, stdout: child.stdout, stderr: child.stderr,
      collected: {}, done, terminate() { child.kill() }, async waitForExit() { await done; return true },
    })
    try {
      await once(child.stdout, 'data')
      guarded.terminate()
      const result = await guarded.done
      assert.ok(result.signal !== null || result.exitCode !== 0)
      assert.equal(await guarded.waitForExit(), true)
      assert.equal(guarded.stderr, undefined)
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill()
      await done.catch(() => {})
    }
  })
}
