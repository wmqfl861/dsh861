/**
 * R44 teardown-ownership forensics (plan.v1 §9.4 + supplement S1/S2).
 *
 * R1 evidence cases: every entry drives the real factory, real Cordis fibers,
 * real durable write handles, and real provider unload through the EXISTING
 * public surface only (`agents.create`, `agentLoop.createAgent`, `setup`
 * effects, `fiber.dispose()`, the `agentLoop.transactions()` effect). No
 * teardown hooks exist here yet; K01–K08 join after the core change.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, symbols } from '@deepseek-ai/cordis'
import type { EffectMeta, Fiber } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionHeader } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import type { SessionPersistenceCreateOptions } from '@deepseek-ai/dsh-session-persistence'
import type { SessionHandle } from '@deepseek-ai/dsh-session-persistence'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { MockAdapter, textResponse } from './mock-adapter.ts'

const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

const OPTIONS = { provider: 'mock', model: 'mock' } as const

/** One fixture-owned durability boundary: run the real close, then the plan's holds/faults. */
type ClosePlan = (realClose: () => Promise<void>) => Promise<void>

async function mount(persistenceRoot?: string): Promise<{ ctx: Context; loopFiber: Fiber }> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt, { personaPrefix: 'You are the deployment.' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  if (persistenceRoot !== undefined) await ctx.plugin(JsonlSessionPersistence, { root: persistenceRoot })
  const loopFiber = await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter(['mock'], new MockAdapter([textResponse('ok')]))
  return { ctx, loopFiber }
}

/**
 * Wrap this fixture's own persistence service so the handles it mints for the
 * planned sessions run injected holds/faults around their real close. The real
 * path always runs first-class; other sessions keep the untouched handle.
 */
function planDurableClose(ctx: Context, plans: Map<SessionId, ClosePlan>): void {
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined) throw new Error('R44 fixture requires a mounted persistence backend')
  const realCreate = persistence.create.bind(persistence)
  const create: (typeof persistence)['create'] = async (
    header: SessionHeader,
    options?: SessionPersistenceCreateOptions,
  ): Promise<SessionHandle> => {
    const handle = await realCreate(header, options)
    const plan = plans.get(header.id)
    if (plan === undefined) return handle
    const realClose = handle.close.bind(handle)
    handle.close = (): Promise<void> => plan(realClose)
    return handle
  }
  Object.assign(persistence, { create })
}

/** The exact effect disposer carrying `label` on `fiber`, as Cordis would run it at unload. */
function requireEffect(fiber: Fiber, label: string): () => void | Promise<void> {
  const found = [...fiber._disposables].find((dispose) => {
    const effect = (dispose as typeof dispose & { [symbols.effect]?: EffectMeta })[symbols.effect]
    return effect?.label === label
  })
  if (found === undefined) throw new Error(`effect ${label} not found`)
  return found as () => void | Promise<void>
}

/** Whether `promise` settled within one short macrotask window; the timer is always cleared. */
async function settlesWithin(promise: Promise<unknown>, ms = 30): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const window = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => { resolve(false) }, ms)
  })
  try {
    return await Promise.race([promise.then(() => true, () => true), window])
  } finally {
    clearTimeout(timer)
  }
}

/** Every distinct Error in an AggregateError/cause tree, identity-preserved. */
function reasonsOf(error: unknown): unknown[] {
  const reasons: unknown[] = []
  const seen = new Set<unknown>()
  const visit = (value: unknown): void => {
    if (!(value instanceof Error) || seen.has(value)) return
    seen.add(value)
    reasons.push(value)
    if (value instanceof AggregateError) for (const inner of value.errors) visit(inner)
    visit(value.cause)
  }
  visit(error)
  return reasons
}

describe('R44 teardown ownership', () => {
  it('R44-K09 factory teardown waits for every started cleanup and reports all original errors', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx, loopFiber } = await mount(root)
    const sentinelA = new Error('R44-K09 sentinel A: durable close rejected')
    const sentinelB = new Error('R44-K09 sentinel B: gated durable close rejected')
    const gateB = Promise.withResolvers<undefined>()
    const bCloseEntered = Promise.withResolvers<undefined>()
    const track: string[] = []
    planDurableClose(ctx, new Map<SessionId, ClosePlan>([
      [SessionId('r44-k09-a'), async (realClose) => {
        await realClose()
        throw sentinelA
      }],
      [SessionId('r44-k09-b'), async (realClose) => {
        track.push('b:close-entered')
        bCloseEntered.resolve(undefined)
        await gateB.promise
        track.push('b:close-released')
        await realClose()
        throw sentinelB
      }],
    ]))

    const a = await ctx.agents.create({ sessionId: SessionId('r44-k09-a'), agentOptions: OPTIONS })
    const b = await ctx.agents.create({ sessionId: SessionId('r44-k09-b'), agentOptions: OPTIONS })
    expect(ctx.agents.get(a.agent.id)).toBe(a.agent)
    expect(ctx.agents.get(b.agent.id)).toBe(b.agent)

    try {
      const factoryTeardown = requireEffect(loopFiber, 'agentLoop.transactions()')
      const factoryOutcome = Promise.resolve(factoryTeardown()).then(
        () => { throw new Error('R44-K09: factory teardown resolved without reporting its real cleanup failures') },
        (error: unknown) => error,
      )
      await bCloseEntered.promise

      // B's real mandatory cleanup is still gated; the factory transaction must
      // not settle while any started work is unfinished.
      expect(await settlesWithin(factoryOutcome)).toBe(false)

      gateB.resolve(undefined)
      const failure = await factoryOutcome
      expect(reasonsOf(failure)).toContain(sentinelA)
      expect(reasonsOf(failure)).toContain(sentinelB)

      // The provider fiber's completion is a separate, later fact.
      await loopFiber.dispose()
      expect(track).toEqual(['b:close-entered', 'b:close-released'])
    } finally {
      gateB.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K10 one failure must not cut short the factory wait for admitted startup work', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx, loopFiber } = await mount(root)
    const sentinelA = new Error('R44-K10 sentinel A: durable close rejected')
    const gateRollback = Promise.withResolvers<undefined>()
    const rollbackCloseEntered = Promise.withResolvers<undefined>()
    const track: string[] = []
    planDurableClose(ctx, new Map<SessionId, ClosePlan>([
      [SessionId('r44-k10-a'), async (realClose) => {
        await realClose()
        throw sentinelA
      }],
      [SessionId('r44-k10-s'), async (realClose) => {
        track.push('s:rollback-close-entered')
        rollbackCloseEntered.resolve(undefined)
        await gateRollback.promise
        track.push('s:rollback-close-ran')
        await realClose()
      }],
    ]))

    await ctx.agents.create({ sessionId: SessionId('r44-k10-a'), agentOptions: OPTIONS })
    // Admitted public startup still unpublished; its rollback recovery is the gated part.
    const startupOutcome = ctx.agents.create({ sessionId: SessionId('r44-k10-s'), agentOptions: OPTIONS })
      .then(
        () => { throw new Error('R44-K10: startup must not publish during factory teardown') },
        (error: unknown) => error,
      )

    try {
      const factoryTeardown = requireEffect(loopFiber, 'agentLoop.transactions()')
      const factoryOutcome = Promise.resolve(factoryTeardown()).then(
        () => { throw new Error('R44-K10: factory teardown resolved without reporting its real cleanup failures') },
        (error: unknown) => error,
      )
      await rollbackCloseEntered.promise

      // The unpublished object never became a resident lifecycle.
      expect(ctx.agents.get(SessionId('r44-k10-s'))).toBeUndefined()
      // A's fast failure must not settle the factory while admitted startup
      // work has started its real rollback recovery and not finished it.
      expect(await settlesWithin(factoryOutcome)).toBe(false)

      gateRollback.resolve(undefined)
      const failure = await factoryOutcome
      expect(reasonsOf(failure)).toContain(sentinelA)

      // The public call keeps its own abort error; the recovery it triggered ran for real.
      const startupError = await startupOutcome
      expect(startupError).toBeInstanceOf(Error)
      expect(track).toContain('s:rollback-close-ran')
      await loopFiber.dispose()
    } finally {
      gateRollback.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K11 provider unload keeps the agent scoped world until real driver use completes', { timeout: 30_000 }, async () => {
    const gateStream = Promise.withResolvers<undefined>()
    const streamEntered = Promise.withResolvers<undefined>()
    const track: string[] = []
    /** Local fake model: the stream stays open until the test releases it, then honors the abort. */
    const heldStream = new (class extends LlmAdapter {
      readonly requests: GenerateOptions[] = []

      override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        this.requests.push(options)
        track.push('k11:stream-entered')
        streamEntered.resolve(undefined)
        await gateStream.promise
        track.push('k11:stream-released')
        if (options.signal?.aborted) throw new Error('aborted after release')
      }
    })()

    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt, { personaPrefix: 'You are the deployment.' })
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    const loopFiber = await ctx.plugin(AgentLoop, { agents: [] })
    ctx.llm.registerAdapter(['mock'], heldStream)

    try {
      // A consumer owner distinct from the factory fiber.
      const consumerFiber = await ctx.plugin(function r44K11Consumer() {})
      const handle = await ctx.agentLoop.createAgent(consumerFiber.ctx, {
        sessionId: SessionId('r44-k11'),
        agentOptions: OPTIONS,
        setup: (agentCtx) => {
          agentCtx.effect(() => () => {
            track.push('k11:scope-registration-revoked')
          }, 'R44-K11.scopeProbe()')
        },
      })
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'hold the stream open' }],
        source: { kind: 'user' },
      }))
      await streamEntered.promise

      // Legal inbox use while its projection is active: cancel clears pending work.
      expect(() => { handle.agent.cancel({ kind: 'user' }) }).not.toThrow()
      track.push('k11:cancel-legal-inbox-use-ok')

      const unload = Promise.resolve(loopFiber.dispose())
      await new Promise((resolve) => { setTimeout(resolve, 20) })

      // The driver's real cleanup is still gated, so the scoped world — this
      // probe registration and the inbox projection behind it — must remain.
      expect(track).not.toContain('k11:scope-registration-revoked')

      gateStream.resolve(undefined)
      await unload
      const releasedAt = track.indexOf('k11:stream-released')
      const revokedAt = track.indexOf('k11:scope-registration-revoked')
      expect(releasedAt).toBeGreaterThanOrEqual(0)
      expect(revokedAt).toBeGreaterThan(releasedAt)
      expect(ctx.agents.get(SessionId('r44-k11'))).toBeUndefined()
    } finally {
      gateStream.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K01 a held beforeRelease keeps the provider structural scope release behind it', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt, { personaPrefix: 'You are the deployment.' })
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    const loopFiber = await ctx.plugin(AgentLoop, { agents: [] })
    ctx.llm.registerAdapter(['mock'], new MockAdapter([textResponse('ok')]))
    const gate = Promise.withResolvers<undefined>()
    const beforeReleaseEntered = Promise.withResolvers<undefined>()
    const track: string[] = []
    try {
      const handle = await ctx.agents.create({
        sessionId: SessionId('r44-k01'),
        agentOptions: OPTIONS,
        setup: (agentCtx) => {
          agentCtx.effect(() => () => { track.push('k01:scope-released') }, 'R44-K01.scopeProbe()')
        },
        teardown: {
          begin: () => { track.push('k01:begin') },
          beforeRelease: async () => {
            track.push('k01:before-release-entered')
            beforeReleaseEntered.resolve(undefined)
            await gate.promise
            track.push('k01:before-release-released')
          },
        },
      })
      expect(handle.agent.status).toBe('idle')

      const unload = Promise.resolve(loopFiber.dispose())
      await beforeReleaseEntered.promise
      // The domain preparation is still running; the scoped world must remain.
      expect(track).not.toContain('k01:scope-released')

      gate.resolve(undefined)
      await unload
      expect(track.indexOf('k01:scope-released')).toBeGreaterThan(track.indexOf('k01:before-release-released'))
      expect(ctx.agents.get(SessionId('r44-k01'))).toBeUndefined()
    } finally {
      gate.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K02 consumer owner, factory owner, and direct handle close share one completion', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx, loopFiber } = await mount(root)
    const gate = Promise.withResolvers<undefined>()
    const beforeReleaseEntered = Promise.withResolvers<undefined>()
    let beginCount = 0
    let beginCompletion: Promise<void> | undefined
    try {
      const ownerFiber = await ctx.plugin(function r44K02Owner() {})
      const handle = await ctx.agentLoop.createAgent(ownerFiber.ctx, {
        sessionId: SessionId('r44-k02'),
        agentOptions: OPTIONS,
        teardown: {
          begin: (_agent, completion) => {
            beginCount += 1
            beginCompletion = completion
          },
          beforeRelease: async () => {
            beforeReleaseEntered.resolve(undefined)
            await gate.promise
          },
        },
      })

      // Handle-first: the direct close starts the one memoized teardown.
      const handleClosed = handle.dispose()
      await beforeReleaseEntered.promise
      expect(beginCompletion).toBe(handleClosed)

      // Owner unload during the open completion joins it instead of starting
      // or bypassing it; the owner fiber settles only with the completion.
      let ownerSettled = false
      const ownerUnload = Promise.resolve(ownerFiber.dispose()).then(() => { ownerSettled = true })
      await new Promise((resolve) => { setTimeout(resolve, 10) })
      expect(ownerSettled).toBe(false)

      gate.resolve(undefined)
      await handleClosed
      await ownerUnload
      expect(beginCount).toBe(1)

      // Resources released: the retired wrappers cannot re-enter the cleanup.
      await loopFiber.dispose()
      expect(beginCount).toBe(1)
      expect(ctx.agents.get(SessionId('r44-k02'))).toBeUndefined()
    } finally {
      gate.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K03 begin publishes the shared completion before any reentrant step, scope still valid', { timeout: 30_000 }, async () => {
    const { ctx } = await mount()
    const seen: { completion: Promise<void>; inboxActive: boolean }[] = []
    try {
      const handle = await ctx.agents.create({
        sessionId: SessionId('r44-k03'),
        agentOptions: OPTIONS,
        teardown: {
          begin: (agent, completion) => {
            seen.push({
              completion,
              // The inbox projection must still be active when begin runs.
              inboxActive: ctx.sessionProjections.stateOf(agent.session, 'inbox') !== undefined,
            })
            // A reentrant cancel from inside begin must not deadlock or skip
            // the remaining obligations; it joins the already-published fact.
            agent.cancel({ kind: 'user' })
          },
          beforeRelease: async () => {},
        },
      })
      const closed = handle.dispose()
      expect(seen).toHaveLength(1)
      expect(seen[0]!.inboxActive).toBe(true)
      expect(seen[0]!.completion).toBe(closed)
      await closed
    } finally {
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K04 beforeRelease finishes before the inbox projection is revoked', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx } = await mount(root)
    const gate = Promise.withResolvers<undefined>()
    let inboxActiveDuringPreparation = false
    try {
      const handle = await ctx.agents.create({
        sessionId: SessionId('r44-k04'),
        agentOptions: OPTIONS,
        teardown: {
          begin: () => {},
          beforeRelease: async (agent) => {
            inboxActiveDuringPreparation = ctx.sessionProjections.stateOf(agent.session, 'inbox') !== undefined
            await gate.promise
          },
        },
      })
      const closed = handle.dispose()
      await new Promise((resolve) => { setTimeout(resolve, 10) })
      // The gated preparation is unfinished, so the projection is still legal.
      expect(inboxActiveDuringPreparation).toBe(true)
      gate.resolve(undefined)
      await closed
      expect(ctx.sessionProjections.stateOf(handle.agent.session, 'inbox')).toBeUndefined()
    } finally {
      gate.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K05 an inbox-clear failure still aborts the driver and preserves the original error', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt, { personaPrefix: 'You are the deployment.' })
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    const adapter = new MockAdapter(['hang'])
    ctx.llm.registerAdapter(['mock'], adapter)
    const sentinel = new Error('R44-K05 inbox clear sentinel')
    try {
      const handle = await ctx.agents.create({ sessionId: SessionId('r44-k05'), agentOptions: OPTIONS })
      const inbox = handle.agent.inbox
      const realClear = inbox.clear.bind(inbox)
      Object.assign(inbox, {
        clear: (): void => {
          realClear()
          throw sentinel
        },
      })
      handle.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'hold the driver' }],
        source: { kind: 'user' },
      }))
      await vi.waitFor(() => { expect(adapter.requests).toHaveLength(1) })

      expect(() => { handle.agent.cancel({ kind: 'user' }) }).toThrow(sentinel)
      // The abort still fired: the held stream unwinds and the driver exits.
      await handle.agent.whenIdle()
      expect(handle.agent.status).toBe('idle')
    } finally {
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K06 hook and storage failures do not skip the remaining releases', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx } = await mount(root)
    const sentinelBegin = new Error('R44-K06 begin sentinel')
    const sentinelClose = new Error('R44-K06 durable close sentinel')
    const track: string[] = []
    planDurableClose(ctx, new Map<SessionId, ClosePlan>([
      [SessionId('r44-k06'), async (realClose) => {
        track.push('k06:close-ran')
        await realClose()
        throw sentinelClose
      }],
    ]))
    try {
      const handle = await ctx.agents.create({
        sessionId: SessionId('r44-k06'),
        agentOptions: OPTIONS,
        setup: (agentCtx) => {
          agentCtx.effect(() => () => { track.push('k06:scope-released') }, 'R44-K06.scopeProbe()')
        },
        teardown: {
          begin: () => { throw sentinelBegin },
          beforeRelease: async () => { track.push('k06:before-release-ran') },
        },
      })
      await expect(handle.dispose()).rejects.toSatisfy((error: unknown) => {
        const reasons = reasonsOf(error)
        return reasons.includes(sentinelBegin) && reasons.includes(sentinelClose)
      })
      // Every other obligation still ran, in order, despite both failures.
      expect(track).toEqual(['k06:before-release-ran', 'k06:scope-released', 'k06:close-ran'])
      expect(ctx.agents.get(SessionId('r44-k06'))).toBeUndefined()
    } finally {
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K07 owner close during setup rolls the unpublished agent fully back', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx } = await mount(root)
    const gate = Promise.withResolvers<undefined>()
    const setupStarted = Promise.withResolvers<undefined>()
    try {
      const ownerFiber = await ctx.plugin(function r44K07Owner() {})
      const creating = ctx.agentLoop.createAgent(ownerFiber.ctx, {
        sessionId: SessionId('r44-k07'),
        agentOptions: OPTIONS,
        setup: async () => {
          setupStarted.resolve(undefined)
          await gate.promise
        },
      })
      const creatingOutcome = creating.then(
        () => { throw new Error('R44-K07: setup must not publish after owner disposal') },
        (error: unknown) => error,
      )
      await setupStarted.promise
      await ownerFiber.dispose()
      const failure = await creatingOutcome
      expect(failure).toBeInstanceOf(Error)
      expect(String(failure)).toMatch(/owner disposed during setup/)
      expect(ctx.agents.get(SessionId('r44-k07'))).toBeUndefined()

      // The rollback released everything the aborted transaction held: the
      // same id is immediately creatable again under a live owner.
      const retried = await ctx.agents.create({ sessionId: SessionId('r44-k07'), agentOptions: OPTIONS })
      expect(ctx.agents.get(SessionId('r44-k07'))).toBe(retried.agent)
      await retried.dispose()
    } finally {
      gate.resolve(undefined)
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })

  it('R44-K08 a same-id successor never joins the prior lifecycle completion', { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-teardown-ownership-'))
    dirs.push(root)
    const { ctx } = await mount(root)
    const seen: { agent: unknown; settled: boolean }[] = []
    try {
      const first = await ctx.agents.create({
        sessionId: SessionId('r44-k08'),
        agentOptions: OPTIONS,
        teardown: {
          begin: (agent, completion) => {
            seen.push({ agent, settled: false })
            void completion.then(() => { seen[0]!.settled = true }, () => { seen[0]!.settled = true })
          },
          beforeRelease: async () => {},
        },
      })
      await first.dispose()
      expect(seen).toHaveLength(1)
      expect(seen[0]!.settled).toBe(true)
      expect(ctx.agents.get(SessionId('r44-k08'))).toBeUndefined()

      // The successor under the same id is a fresh lifecycle: it stays live,
      // unaffected by the settled predecessor.
      const second = await ctx.agents.create({ sessionId: SessionId('r44-k08'), agentOptions: OPTIONS })
      expect(second.agent).not.toBe(first.agent)
      expect(ctx.agents.get(SessionId('r44-k08'))).toBe(second.agent)
      expect(seen).toHaveLength(1)
      await second.dispose()
    } finally {
      await ctx.fiber.dispose().catch(() => undefined)
    }
  })
})
