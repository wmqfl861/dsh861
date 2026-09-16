import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import { SessionAlreadyOwnedError } from '@deepseek-ai/dsh-session-persistence'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { OwnedTestContexts, mountWriteOwnershipProbe } from './owned-contexts.ts'

const owned = new OwnedTestContexts()

afterEach(() => owned.cleanup())

/** Drain already-scheduled macrotasks so a premature settlement becomes observable. */
function drainMacrotasks(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

/** Build the same owned fixture the control and team suites build: a real persistence-backed runtime with a lead agent. */
async function buildOwnedFixture(script: ConstructorParameters<typeof MockAdapter>[0] = []) {
  const ctx = new Context()
  const fixture = owned.own(ctx)
  await mountAgentLoopTestDependencies(ctx)
  const root = owned.ownRoot(fixture, mkdtempSync(join(tmpdir(), 'dsh-owned-contexts-')))
  await ctx.plugin(JsonlSessionPersistence, { root })
  await ctx.plugin(AgentLoop, { agents: [] })
  const adapter = new MockAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  const lead = await ctx.agentLoop.create(SessionId('owned-lead'), { provider: 'mock', model: 'mock' })
  return { ctx, fixture, root, lead, adapter }
}

/** Drive one real business turn so the lead session materializes and its runtime holds the kernel write lock. */
async function settleRealTurn(lead: Agent, adapter: MockAdapter): Promise<void> {
  lead.followup(createUserMessage({
    content: [{ type: 'text', text: 'materialize the session' }],
    source: { kind: 'user' },
  }))
  await lead.whenIdle()
  expect(adapter.requests).toHaveLength(1)
}

/** Observe that a fixture Context's mounted services are gone after cleanup disposed its runtime. */
function servicesGone(ctx: Context): void {
  expect(ctx.get('sessionPersistence')).toBeUndefined()
}

describe('owned test contexts', () => {
  it('closes a materialized write handle and releases its lock before deleting the root', async () => {
    const { ctx, fixture, root, lead, adapter } = await buildOwnedFixture([textResponse('lead turn done')])
    await settleRealTurn(lead, adapter)
    // The durability barrier publishes the turn's buffered events; a real event
    // log then exists on disk and the session is no longer a pending creation.
    await ctx.sessionPersistence.flush()
    const snapshot = await ctx.sessionPersistence.stat(lead.id)
    expect(snapshot?.sizeBytes).toBeGreaterThan(0)
    const probe = await mountWriteOwnershipProbe(root)
    try {
      // The live runtime holds the session's real kernel write ownership.
      await expect(probe.claim(lead.id)).rejects.toBeInstanceOf(SessionAlreadyOwnedError)
      // After the runtime settles — and before its directory is deleted — an
      // independent owner must be able to take over the same write ownership
      // without any path being deleted or recreated.
      fixture.afterDispose = async () => {
        const takeover = await probe.claim(lead.id)
        await takeover.close()
      }
      await expect(owned.cleanup()).resolves.toBeUndefined()
      expect(existsSync(root)).toBe(false)
      servicesGone(ctx)
    } finally {
      await probe.dispose()
    }
  })

  it('keeps the root until a held disposer settles', async () => {
    const { ctx, root } = await buildOwnedFixture()
    const gate = Promise.withResolvers<undefined>()
    const disposerStarted = Promise.withResolvers<undefined>()
    // The disposer resolves the handshake and returns the held promise, so the
    // fiber's unload provably reached it and cannot settle before the gate.
    ctx.effect(() => () => {
      disposerStarted.resolve(undefined)
      return gate.promise
    })
    let cleanupSettled = false
    const cleanupDone = owned.cleanup().finally(() => { cleanupSettled = true })
    let cleanupFailure: unknown
    try {
      // Deterministic happens-before check: a cleanup that never disposes, or
      // that does not await the disposal, settles before the disposer runs.
      const first = await Promise.race([
        disposerStarted.promise.then(() => 'disposer-reached' as const),
        cleanupDone.then(() => 'cleanup-settled' as const, () => 'cleanup-settled' as const),
      ])
      expect(first).toBe('disposer-reached')
      await drainMacrotasks()
      // While the disposer is held, cleanup cannot settle and the root stays.
      expect(cleanupSettled).toBe(false)
      expect(existsSync(root)).toBe(true)
    } finally {
      // Unconditional, even when an assertion above failed: the held disposer
      // is released and the already-started cleanup awaited to completion. The
      // settlement is captured, not awaited bare, so a cleanup failure cannot
      // displace an assertion error thrown above.
      gate.resolve(undefined)
      cleanupFailure = await cleanupDone.then(() => undefined, (error: unknown) => error)
    }
    expect(cleanupFailure).toBeUndefined()
    expect(cleanupSettled).toBe(true)
    expect(existsSync(root)).toBe(false)
    servicesGone(ctx)
  })

  it('releases the held gate and awaits cleanup when its assertions fail early', async () => {
    const { ctx, root } = await buildOwnedFixture()
    const gate = Promise.withResolvers<undefined>()
    const disposerStarted = Promise.withResolvers<undefined>()
    ctx.effect(() => () => {
      disposerStarted.resolve(undefined)
      return gate.promise
    })
    let cleanupSettled = false
    const cleanupDone = owned.cleanup().finally(() => { cleanupSettled = true })
    const sentinel = new Error('owned-contexts sentinel: assertion failed while the disposer was held')
    let gateReleasedInFinally = false
    let cleanupAwaitedInFinally = false
    let secondaryCleanupFailure: unknown
    let observed: unknown = 'no error reached the driver'
    try {
      try {
        const first = await Promise.race([
          disposerStarted.promise.then(() => 'disposer-reached' as const),
          cleanupDone.then(() => 'cleanup-settled' as const, () => 'cleanup-settled' as const),
        ])
        expect(first).toBe('disposer-reached')
        await drainMacrotasks()
        // The original happens-before observations still run before the gate
        // moves; the throw then stands in for any assertion failing here.
        expect(cleanupSettled).toBe(false)
        expect(existsSync(root)).toBe(true)
        throw sentinel
      } finally {
        // The finally alone owns the release and the wait, so the early
        // failure cannot strand the held disposer or the started cleanup. A
        // secondary cleanup failure is captured beside, not instead of, the
        // sentinel.
        gate.resolve(undefined)
        gateReleasedInFinally = true
        secondaryCleanupFailure = await cleanupDone.then(() => undefined, (error: unknown) => error)
        cleanupAwaitedInFinally = true
      }
    } catch (error) {
      observed = error
    }
    expect(observed).toBe(sentinel)
    expect(gateReleasedInFinally).toBe(true)
    expect(cleanupAwaitedInFinally).toBe(true)
    expect(secondaryCleanupFailure).toBeUndefined()
    expect(cleanupSettled).toBe(true)
    expect(existsSync(root)).toBe(false)
    servicesGone(ctx)
  })

  it('cleans a fixture whose setup failed after its resources existed', async () => {
    const sentinel = new Error('owned-contexts sentinel: setup failed midway')
    const setup = async (): Promise<void> => {
      await buildOwnedFixture()
      // A later setup step fails, like a failing plugin mount would.
      throw sentinel
    }
    await expect(setup()).rejects.toThrow(sentinel)
    const fixtures = owned.snapshot()
    expect(fixtures).toHaveLength(1)
    expect(fixtures[0]?.root).toBeDefined()
    await expect(owned.cleanup()).resolves.toBeUndefined()
    expect(existsSync(fixtures[0]!.root!)).toBe(false)
    servicesGone(fixtures[0]!.ctx)
  })

  it('still cleans healthy fixtures when one observation vetoes a deletion', async () => {
    const veto = new Error('owned-contexts sentinel: quiescence not proven')
    const failing = await buildOwnedFixture()
    const healthy = await buildOwnedFixture()
    expect(owned.snapshot()).toHaveLength(2)
    failing.fixture.afterDispose = () => Promise.reject(veto)
    try {
      await expect(owned.cleanup()).rejects.toThrow(veto)
      // The vetoed fixture's directory stays for diagnosis; the healthy
      // fixture is still disposed and its directory still deleted.
      expect(existsSync(failing.root)).toBe(true)
      expect(existsSync(healthy.root)).toBe(false)
      servicesGone(failing.ctx)
      servicesGone(healthy.ctx)
    } finally {
      rmSync(failing.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    }
  })

  it('owns a rootless context and tolerates a repeated cleanup', async () => {
    const ctx = new Context()
    const fixture = owned.own(ctx)
    await mountAgentLoopTestDependencies(ctx)
    expect(fixture.root).toBeUndefined()
    await expect(owned.cleanup()).resolves.toBeUndefined()
    expect(ctx.get('llm')).toBeUndefined()
    // The second call is a no-op: nothing is disposed or deleted twice.
    await expect(owned.cleanup()).resolves.toBeUndefined()
  })

  describe('disposal failures reported only to the logger', () => {
    it('vetoes the deletion when a root effect disposer throws', async () => {
      const { ctx, root } = await buildOwnedFixture()
      const sentinel = new Error('owned-contexts sentinel: root disposer threw')
      // A root-fiber effect with no fixture.afterDispose: the framework logs
      // this failure inside fiber.dispose() and still resolves the disposal,
      // so only observing the fixture's structured logger outlet can veto.
      ctx.effect(() => () => {
        throw sentinel
      })
      // Independent witness on the same outlet: the cleanup observer must add
      // a veto, never replace or swallow the original error delivery.
      const witnessed: unknown[] = []
      ctx.logger.exporters.set(-2, {
        export: (message) => {
          if (message.type === 'error') witnessed.push(message.args[0])
        },
      })
      try {
        const failure = await owned.cleanup().then(() => undefined, (error: unknown) => error)
        expect(failure).toBeInstanceOf(AggregateError)
        expect((failure as AggregateError).errors).toContain(sentinel)
        expect(existsSync(root)).toBe(true)
        servicesGone(ctx)
        expect(witnessed).toContain(sentinel)
      } finally {
        ctx.logger.exporters.delete(-2)
        // Cleanup settled and the helper detached its own observer before
        // rejecting, so the test's own residue is the only thing left to remove.
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      }
    })

    it('vetoes the deletion when a child plugin disposer rejects', async () => {
      const { ctx, root } = await buildOwnedFixture()
      const sentinel = new Error('owned-contexts sentinel: child disposer rejected')
      await ctx.plugin(() => async () => {
        throw sentinel
      })
      try {
        const failure = await owned.cleanup().then(() => undefined, (error: unknown) => error)
        expect(failure).toBeInstanceOf(AggregateError)
        expect((failure as AggregateError).errors).toContain(sentinel)
        expect(existsSync(root)).toBe(true)
        servicesGone(ctx)
      } finally {
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      }
    })

    it('still vetoes when the child disposer fails only after a deferred release', async () => {
      const { ctx, root } = await buildOwnedFixture()
      const sentinel = new Error('owned-contexts sentinel: deferred child disposer failure')
      const started = Promise.withResolvers<undefined>()
      const release = Promise.withResolvers<undefined>()
      await ctx.plugin(() => async () => {
        started.resolve(undefined)
        await release.promise
        throw sentinel
      })
      let cleanupSettled = false
      const cleanupDone = owned.cleanup().finally(() => { cleanupSettled = true })
      // The deferred disposer provably entered its wait; no error exists yet.
      const first = await Promise.race([
        started.promise.then(() => 'disposer-reached' as const),
        cleanupDone.then(() => 'cleanup-settled' as const, () => 'cleanup-settled' as const),
      ])
      expect(first).toBe('disposer-reached')
      await drainMacrotasks()
      expect(cleanupSettled).toBe(false)
      expect(existsSync(root)).toBe(true)
      // The failure appears only after the real deferred cleanup is released;
      // an observer that stopped before this point would miss it.
      release.resolve(undefined)
      try {
        const failure = await cleanupDone.then(() => undefined, (error: unknown) => error)
        expect(failure).toBeInstanceOf(AggregateError)
        expect((failure as AggregateError).errors).toContain(sentinel)
        expect(existsSync(root)).toBe(true)
        servicesGone(ctx)
      } finally {
        rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      }
    })

    it('keeps both faulty fixtures and their sentinels while a healthy fixture still cleans', async () => {
      const rootFailing = await buildOwnedFixture()
      const childFailing = await buildOwnedFixture()
      const healthy = await buildOwnedFixture()
      const rootSentinel = new Error('owned-contexts sentinel: multi-fixture root failure')
      const childSentinel = new Error('owned-contexts sentinel: multi-fixture child failure')
      rootFailing.ctx.effect(() => () => {
        throw rootSentinel
      })
      await childFailing.ctx.plugin(() => async () => {
        throw childSentinel
      })
      try {
        const failure = await owned.cleanup().then(() => undefined, (error: unknown) => error)
        expect(failure).toBeInstanceOf(AggregateError)
        const perFixture = (failure as AggregateError).errors as unknown[]
        expect(perFixture).toHaveLength(2)
        // Each fixture's own aggregate names its kept directory, so the two
        // independent failures stay attributed to their fixtures.
        const aggregateFor = (root: string) => perFixture.find(
          (entry): entry is AggregateError => entry instanceof AggregateError && entry.message.includes(root),
        )
        expect(aggregateFor(rootFailing.root)?.errors).toContain(rootSentinel)
        expect(aggregateFor(childFailing.root)?.errors).toContain(childSentinel)
        expect(existsSync(rootFailing.root)).toBe(true)
        expect(existsSync(childFailing.root)).toBe(true)
        expect(existsSync(healthy.root)).toBe(false)
        servicesGone(rootFailing.ctx)
        servicesGone(childFailing.ctx)
        servicesGone(healthy.ctx)
      } finally {
        rmSync(rootFailing.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
        rmSync(childFailing.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      }
    })
  })
})
