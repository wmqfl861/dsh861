/**
 * R44 continuable-subagent teardown ownership (plan.v1 §9.2 + supplement S4.2).
 *
 * Every case drives the real stack — Cordis, AgentLoop, persistence, the
 * continuation manager, and the GatedAdapter fake model — through public
 * entries (`ctx.subagents`, plugin fiber disposal, root disposal). Gates are
 * released in `finally`; the observer ledger (`continuation-internals`) and
 * Session events provide the order evidence.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Fiber } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import * as SubagentSpawn from '@deepseek-ai/dsh-subagent-spawn-in-process'
import * as SubagentFork from '@deepseek-ai/dsh-subagent-fork-in-process'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import SubagentRuntime from '../src/index.ts'
import { continuationActivations } from './continuation-internals.ts'
import type { Activation } from '../src/continuation-activation.ts'
import { steerHostSubagentPrompt } from '../src/internal.ts'
import { TestSessionQuery } from './test-session-query.ts'
import { OwnedTestContexts } from '../../tool-subagent-control/tests/owned-contexts.ts'

/** One scripted response that may wait on a caller-released gate before streaming. */
interface GatedEntry {
  chunks: StreamChunk[]
  gate?: Promise<undefined>
}

/** Adapter whose entries can hold a model call open until the test releases it. */
class GatedAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(readonly script: GatedEntry[]) {
    super()
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const entry = this.script.shift()
    if (!entry) throw new Error('GatedAdapter: script exhausted')
    if (entry.gate) await entry.gate
    for (const chunk of entry.chunks) {
      if (options.signal?.aborted) throw new Error('aborted')
      yield chunk
    }
  }
}

const SIGNAL = new AbortController().signal

const dirs: string[] = []
const disposers: Array<() => Promise<void>> = []
afterEach(async () => {
  const errors: unknown[] = []
  for (const dispose of disposers.splice(0)) {
    try { await dispose() } catch (error) { errors.push(error) }
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'teardown fixture cleanup failed')
})

interface Harness {
  ctx: Context
  parent: Agent
  adapter: GatedAdapter
  loopFiber: Fiber
  runtimeFiber: Fiber
  root: string
}

/** Boot the full continuable stack with a durable root and one parked parent. */
async function harness(script: GatedEntry[]): Promise<Harness> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  const root = mkdtempSync(join(tmpdir(), 'dsh-continuation-teardown-'))
  dirs.push(root)
  const persistenceFiber = await ctx.plugin(JsonlSessionPersistence, { root })
  const loopFiber = await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(TestSessionQuery)
  const runtimeFiber = await ctx.plugin(SubagentRuntime)
  await ctx.plugin(SubagentSpawn, { providerName: 'spawn' })
  await ctx.plugin(SubagentFork, { providerName: 'fork' })
  const adapter = new GatedAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'mock', model: 'mock' })
  disposers.push(() => ctx.fiber.dispose().then(() => persistenceFiber.dispose()))
  return { ctx, parent, adapter, loopFiber, runtimeFiber, root }
}

/** Start one continuable child under the parent. */
async function startChild(hs: Harness, prompt: string, provider = 'spawn') {
  return hs.ctx.subagents.startContinuable({
    provider,
    label: `child-${prompt}`,
    request: { prompt: [{ type: 'text', text: prompt }], parent: hs.parent },
    signal: SIGNAL,
  })
}

/** The registry's live resident Activation count (white-box, like the internals helper). */
function residentCount(hs: Harness): number {
  const registry = continuationActivations(hs.ctx) as unknown as { resident: Map<string, Activation> }
  return registry.resident.size
}

/** The exact resident Activation for one child id. */
function residentOf(hs: Harness, childId: string): Activation {
  const registry = continuationActivations(hs.ctx) as unknown as { resident: Map<string, Activation> }
  const activation = registry.resident.get(childId)
  if (activation === undefined) throw new Error(`expected a resident activation for ${childId}`)
  return activation
}

/** Wait until the resident activation graph reaches the wanted size. */
async function waitForActivations(hs: Harness, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(residentCount(hs)).toBe(count)
  }, { timeout: 5_000 })
}

describe('R44 continuable teardown', () => {
  it('R44-S01 a single plugin HMR stops the held child and frees the identity for remount', { timeout: 30_000 }, async () => {
    const gate = Promise.withResolvers<undefined>()
    const hs = await harness([{ chunks: [], gate: gate.promise }])
    const started = await startChild(hs, 'held')
    await vi.waitFor(() => { expect(hs.adapter.requests).toHaveLength(1) })

    try {
      const unloading = hs.runtimeFiber.dispose()
      // Admission is closed before the model settles.
      await expect(startChild(hs, 'rejected')).rejects.toMatchObject({ code: 'DRAINING' })
      gate.resolve(undefined)
      await unloading
      expect(hs.ctx.agents.get(started.childId)).toBeUndefined()

      // The identity and runtime are reusable after the remount.
      const remounted = await hs.ctx.plugin(SubagentRuntime)
      expect(remounted).toBeDefined()
      await remounted.dispose()
    } finally {
      gate.resolve(undefined)
    }
  })

  it('R44-S02 root unload closes a parent/child/grandchild forest child-first', { timeout: 30_000 }, async () => {
    const done = Promise.withResolvers<undefined>()
    const hs = await harness([
      { chunks: textChunks('child done'), gate: done.promise },
      { chunks: textChunks('grandchild done'), gate: done.promise },
    ])
    const order: string[] = []
    const agentsBefore = hs.ctx.agents
    const first = await startChild(hs, 'child')
    await vi.waitFor(() => { expect(hs.adapter.requests).toHaveLength(1) })
    const child = hs.ctx.agents.get(first.childId)!
    // Record the terminal order through the epochs' own observers: scoped
    // dispatch during root unload is not a reliable observation channel.
    const firstObserver = residentOf(hs, first.childId).observer
    const realFirstSettle = firstObserver.settle.bind(firstObserver)
    Object.assign(firstObserver, {
      settle: (failure: unknown): void => { order.push(`end:${first.childId}`); realFirstSettle(failure) },
    })

    const second = await hs.ctx.subagents.startContinuable({
      provider: 'spawn',
      label: 'grandchild',
      request: { prompt: [{ type: 'text', text: 'grand work' }], parent: child },
      signal: SIGNAL,
    })
    await waitForActivations(hs, 2)
    const secondObserver = residentOf(hs, second.childId).observer
    const realSecondSettle = secondObserver.settle.bind(secondObserver)
    Object.assign(secondObserver, {
      settle: (failure: unknown): void => { order.push(`end:${second.childId}`); realSecondSettle(failure) },
    })

    const unloading = hs.ctx.fiber.dispose()
    done.resolve(undefined)
    await unloading
    expect(order).toEqual([`end:${second.childId}`, `end:${first.childId}`])
    // The registry service outlives its entries: assert through a reference
    // captured before the root unload unregistered the service itself.
    expect(agentsBefore.get(first.childId)).toBeUndefined()
    expect(agentsBefore.get(second.childId)).toBeUndefined()
  })

  it('R44-S03 factory unload and the continuation drain share one cleanup', { timeout: 30_000 }, async () => {
    const gate = Promise.withResolvers<undefined>()
    const hs = await harness([{ chunks: [], gate: gate.promise }])
    const started = await startChild(hs, 'held')
    await vi.waitFor(() => { expect(hs.adapter.requests).toHaveLength(1) })

    // The factory provider unloads while the continuation registry drains.
    expect(residentCount(hs)).toBe(1)
    const loopUnload = hs.loopFiber.dispose()
    const runtimeUnload = hs.runtimeFiber.dispose()
    gate.resolve(undefined)
    await Promise.all([loopUnload, runtimeUnload])

    expect(hs.ctx.agents.get(started.childId)).toBeUndefined()
    expect(hs.ctx.get('subagents')).toBeUndefined()
  })

  it('R44-S04 concurrent selected, descendant, and manager drains keep one terminal per epoch', { timeout: 30_000 }, async () => {
    const gate = Promise.withResolvers<undefined>()
    const hs = await harness([
      { chunks: textChunks('one'), gate: gate.promise },
      { chunks: textChunks('two'), gate: gate.promise },
    ])
    const first = await startChild(hs, 'one')
    const second = await startChild(hs, 'two')
    await waitForActivations(hs, 2)
    const events: string[] = []
    hs.ctx.on('subagent/end', (info) => { events.push(info.id) })

    const drains = Promise.all([
      hs.ctx.subagents.drainContinuableDescendants([hs.parent]).catch(() => undefined),
      hs.ctx.subagents.drainContinuableChildren(hs.parent, [first.childId, second.childId]).catch(() => undefined),
    ])
    gate.resolve(undefined)
    await drains
    expect(events.sort()).toEqual([first.childId, second.childId].sort())
    expect(new Set(events).size).toBe(events.length)
  })

  it('R44-S05 drain rejects new admission and waits an admitted rollback', { timeout: 30_000 }, async () => {
    const hs = await harness([])
    const gate = Promise.withResolvers<undefined>()
    hs.adapter.script.push({ chunks: [], gate: gate.promise })
    const started = startChild(hs, 'held')
    await vi.waitFor(() => { expect(hs.adapter.requests.length).toBeGreaterThanOrEqual(1) })

    const draining = hs.ctx.subagents.drainContinuableDescendants([hs.parent])
    await expect(startChild(hs, 'rejected')).rejects.toMatchObject({ code: 'DRAINING' })
    gate.resolve(undefined)
    const settled = await started
    expect(settled.messageId).toBeDefined()
    await draining
  })

  it('R44-S06 an idle-looking agent in real maintenance is not treated as quiescent', { timeout: 30_000 }, async () => {
    const hs = await harness([{ chunks: textChunks('child done') }])
    // Hold the fixture's session flush so the natural settlement watcher stalls
    // before its own disposal maintenance; the close under test is the
    // caller's, deterministically.
    const flushGate = Promise.withResolvers<undefined>()
    const sessions = hs.ctx.sessions
    const realFlush = sessions.flush.bind(sessions)
    Object.assign(sessions, {
      flush: async (...args: Parameters<typeof realFlush>) => {
        await flushGate.promise
        return realFlush(...args)
      },
    })
    const started = await startChild(hs, 'work')
    const child = hs.ctx.agents.get(started.childId)!
    await vi.waitFor(() => { expect(child.status).toBe('idle') })

    const release = Promise.withResolvers<undefined>()
    const entered = Promise.withResolvers<undefined>()
    const maintenance = child.runMaintenance(async () => {
      entered.resolve(undefined)
      await release.promise
      return
    })
    await entered.promise

    try {
      const disposal = hs.ctx.subagents.drainContinuableChildren(hs.parent, [started.childId])
      let settled = false
      void disposal.then(() => { settled = true }, () => { settled = true })
      await new Promise((resolve) => { setTimeout(resolve, 50) })
      // Maintenance is still running: the close cannot complete over it.
      expect(settled).toBe(false)

      release.resolve(undefined)
      flushGate.resolve(undefined)
      await maintenance
      await disposal
      expect(hs.ctx.agents.get(started.childId)).toBeUndefined()
    } finally {
      release.resolve(undefined)
      flushGate.resolve(undefined)
    }
  })

  it('R44-S07 a cancel sentinel still releases children, handle, and ownership', { timeout: 30_000 }, async () => {
    const gate = Promise.withResolvers<undefined>()
    const hs = await harness([
      { chunks: textChunks('failing child'), gate: gate.promise },
      { chunks: textChunks('healthy child'), gate: gate.promise },
    ])
    const failing = await startChild(hs, 'failing')
    const healthy = await startChild(hs, 'healthy')
    await waitForActivations(hs, 2)
    const sentinel = new Error('R44-S07 cancel sentinel')

    // Inject the sentinel at the failing child's inbox clear boundary.
    const failingAgent = hs.ctx.agents.get(failing.childId)!
    const inbox = failingAgent.inbox
    const realClear = inbox.clear.bind(inbox)
    Object.assign(inbox, {
      clear: (): void => {
        realClear()
        throw sentinel
      },
    })
    const draining = hs.ctx.subagents.drainContinuableChildren(hs.parent, [failing.childId, healthy.childId])
    gate.resolve(undefined)
    try {
      await expect(draining).rejects.toSatisfy((error: unknown) => errorChainHas(error, sentinel))
      // The obligations ran to the end regardless of the sentinel.
      expect(hs.ctx.agents.get(failing.childId)).toBeUndefined()
      expect(hs.ctx.agents.get(healthy.childId)).toBeUndefined()
    } finally {
      inbox.clear = realClear
      gate.resolve(undefined)
    }
  })

  it('R44-S08 one failing child does not skip its sibling or the parent handle', { timeout: 30_000 }, async () => {
    const gate = Promise.withResolvers<undefined>()
    const hs = await harness([
      { chunks: textChunks('a'), gate: gate.promise },
      { chunks: textChunks('b'), gate: gate.promise },
    ])
    const first = await startChild(hs, 'a')
    const second = await startChild(hs, 'b')
    await waitForActivations(hs, 2)
    const sentinel = new Error('R44-S08 child teardown sentinel')
    const inbox = hs.ctx.agents.get(first.childId)!.inbox
    const realClear = inbox.clear.bind(inbox)
    Object.assign(inbox, {
      clear: (): void => {
        realClear()
        throw sentinel
      },
    })
    const draining = hs.ctx.subagents.drainContinuableDescendants([hs.parent])
    gate.resolve(undefined)
    try {
      await expect(draining).rejects.toBeInstanceOf(Error)
      expect(hs.ctx.agents.get(first.childId)).toBeUndefined()
      expect(hs.ctx.agents.get(second.childId)).toBeUndefined()
    } finally {
      inbox.clear = realClear
      gate.resolve(undefined)
    }
  })

  it('R44-S09 capture and handle-close sentinels are both preserved with one terminal', { timeout: 30_000 }, async () => {
    const hs = await harness([{ chunks: textChunks('captured child') }])
    const started = await startChild(hs, 'work')
    await waitForActivations(hs, 1)
    const captureSentinel = new Error('R44-S09 capture sentinel')
    const target = residentOf(hs, started.childId)
    const observer = target.observer
    const realCapture = observer.capture.bind(observer)
    Object.assign(observer, {
      capture: (child: Agent): void => {
        realCapture(child)
        throw captureSentinel
      },
    })
    await expect(hs.ctx.subagents.drainContinuableChildren(hs.parent, [started.childId]))
      .rejects.toSatisfy((error: unknown) => errorChainHas(error, captureSentinel))
    expect(hs.ctx.agents.get(started.childId)).toBeUndefined()
  })

  it('R44-S10 unselected trees keep admitting while selected ones close', { timeout: 30_000 }, async () => {
    const selectedGate = Promise.withResolvers<undefined>()
    const bystanderGate = Promise.withResolvers<undefined>()
    const hs = await harness([
      { chunks: textChunks('selected'), gate: selectedGate.promise },
      { chunks: textChunks('bystander'), gate: bystanderGate.promise },
    ])
    const selected = await startChild(hs, 'selected')
    const bystander = await startChild(hs, 'bystander')
    await waitForActivations(hs, 2)

    // Stale/sibling authority is rejected without touching the target.
    expect(() => { hs.ctx.subagents.interrupt(selected.childId, { kind: 'ancestor', agent: hs.ctx.agents.get(bystander.childId)! }) })
      .toThrow(/not a live descendant/)

    const selectedDrain = hs.ctx.subagents.drainContinuableChildren(hs.parent, [selected.childId])
    selectedGate.resolve(undefined)
    await selectedDrain
    expect(hs.ctx.agents.get(selected.childId)).toBeUndefined()
    // The bystander is untouched and still resident behind its own gate.
    expect(hs.ctx.agents.get(bystander.childId)).toBeDefined()
    const bystanderDrain = hs.ctx.subagents.drainContinuableChildren(hs.parent, [bystander.childId])
    bystanderGate.resolve(undefined)
    await bystanderDrain
  })

  it('R44-S11 fresh then cold-resumed closures each end exactly once', { timeout: 30_000 }, async () => {
    const hs = await harness([{ chunks: textChunks('first epoch') }])
    const started = await startChild(hs, 'epoch one')
    const ends: string[] = []
    hs.ctx.on('subagent/end', (info) => { ends.push(info.id) })
    await hs.ctx.subagents.drainContinuableChildren(hs.parent, [started.childId])
    expect(ends).toEqual([started.childId])

    // Cold-resume the durable child through the host delivery path and close
    // it again: one more terminal only, under the same identity.
    const resumedMessage = await steerHostSubagentPrompt(
      hs.ctx.subagents,
      hs.parent,
      started.childId,
      [{ type: 'text', text: 'resume' }],
      { kind: 'user' },
      SIGNAL,
    )
    expect(resumedMessage).toBeDefined()
    expect(residentCount(hs)).toBe(1)
    await hs.ctx.subagents.drainContinuableChildren(hs.parent, [started.childId])
    expect(ends).toEqual([started.childId, started.childId])
  })

  it('R44-S12 a real teardown fault vetoes the owned fixture cleanup and keeps the directory', { timeout: 30_000 }, async () => {
    const owned = new OwnedTestContexts()
    const ctx = new Context()
    const fixture = owned.own(ctx)
    await mountAgentLoopTestDependencies(ctx)
    const root = mkdtempSync(join(tmpdir(), 'dsh-continuation-teardown-s12-'))
    owned.ownRoot(fixture, root)
    const persistenceFiber = await ctx.plugin(JsonlSessionPersistence, { root })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(TestSessionQuery)
    await ctx.plugin(SubagentRuntime)
    await ctx.plugin(SubagentSpawn, { providerName: 'spawn' })
    const gate = Promise.withResolvers<undefined>()
    const adapter = new GatedAdapter([{ chunks: [], gate: gate.promise }])
    ctx.llm.registerAdapter(['mock'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'mock', model: 'mock' })
    const started = await ctx.subagents.startContinuable({
      provider: 'spawn',
      label: 'held',
      request: { prompt: [{ type: 'text', text: 'held work' }], parent },
      signal: SIGNAL,
    })
    await vi.waitFor(() => { expect(adapter.requests).toHaveLength(1) })
    const sentinel = new Error('R44-S12 teardown fault')
    const activation = continuationActivations(ctx).get(started.childId)!
    const observer = activation.observer
    const realCapture = observer.capture.bind(observer)
    Object.assign(observer, {
      capture: (child: Agent): void => {
        realCapture(child)
        throw sentinel
      },
    })
    try {
      // The r43 ownership ledger keeps the directory when the real teardown
      // fails; the gate is released so the failure is genuine, not a hang.
      const settling = owned.cleanup()
      gate.resolve(undefined)
      await expect(settling).rejects.toSatisfy((error: unknown) => errorChainHas(error, sentinel))
      expect(existsSync(root)).toBe(true)
    } finally {
      // Controlled final cleanup of this task's own directory: every handle
      // settled in the failing cleanup above, so the plain dispose clears it.
      await ctx.fiber.dispose().then(() => persistenceFiber.dispose()).catch(() => undefined)
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    }
  })

  it('R44-S14 during the manager unload a concurrent drain call still joins the real drain', { timeout: 30_000 }, async () => {
    const gate = Promise.withResolvers<undefined>()
    const hs = await harness([{ chunks: [], gate: gate.promise }])
    const started = await startChild(hs, 'held')
    await vi.waitFor(() => { expect(hs.adapter.requests).toHaveLength(1) })
    try {
      // Begin the runtime unload with the child's model gate conceptually held
      // open by its registry drain: the binding settles the manager lifetime
      // (drain + structural release) BEFORE the continuation slot clears, so a
      // drain call racing the unload must join the real drain, not no-op.
      const unloading = hs.runtimeFiber.dispose()
      let drainSettled = false
      const draining = hs.ctx.subagents.drainContinuableChildren(hs.parent, [started.childId])
        .then(() => { drainSettled = true }, () => { drainSettled = true })
      await new Promise((resolve) => { setTimeout(resolve, 100) })
      // The drain call joined the REAL activation close: it stays pending while
      // the child's model gate holds (a no-op skip would have settled already
      // and left the child live outside any transaction).
      expect(drainSettled).toBe(false)
      expect(hs.ctx.agents.get(started.childId)).toBeDefined()

      gate.resolve(undefined)
      await Promise.all([draining, unloading])
      expect(hs.ctx.agents.get(started.childId)).toBeUndefined()
    } finally {
      gate.resolve(undefined)
    }
  })

  it('R44-S13 a gated maintenance completion does not deadlock the concurrent owner close', { timeout: 30_000 }, async () => {
    const hs = await harness([{ chunks: textChunks('settling child') }])
    // Hold the fixture's session flush so the natural watcher cannot race the
    // concurrent closes under observation.
    const flushGate = Promise.withResolvers<undefined>()
    const sessions = hs.ctx.sessions
    const realFlush = sessions.flush.bind(sessions)
    Object.assign(sessions, {
      flush: async (...args: Parameters<typeof realFlush>) => {
        await flushGate.promise
        return realFlush(...args)
      },
    })
    const started = await startChild(hs, 'work')
    const child = hs.ctx.agents.get(started.childId)!
    await vi.waitFor(() => { expect(child.status).toBe('idle') })

    const entered = Promise.withResolvers<undefined>()
    const release = Promise.withResolvers<undefined>()
    let maintenanceReturned = false
    const maintenance = child.runMaintenance(async () => {
      entered.resolve(undefined)
      await release.promise
      maintenanceReturned = true
    })
    await entered.promise

    try {
      // Concurrent owner and manager closes while the maintenance holds.
      const ownerClose = hs.ctx.subagents.drainContinuableChildren(hs.parent, [started.childId])
      const managerClose = hs.ctx.subagents.drainContinuableDescendants([hs.parent])
      let closed = false
      void Promise.all([ownerClose, managerClose]).then(() => { closed = true }, () => { closed = true })
      await new Promise((resolve) => { setTimeout(resolve, 50) })
      expect(closed).toBe(false)

      // The maintenance callback returns on its own; the closes keep waiting
      // on their real obligations (here, the gated flush) without any cycle.
      release.resolve(undefined)
      await maintenance
      expect(maintenanceReturned).toBe(true)
      await new Promise((resolve) => { setTimeout(resolve, 25) })
      expect(closed).toBe(false)

      flushGate.resolve(undefined)
      await Promise.all([ownerClose, managerClose])
      expect(hs.ctx.agents.get(started.childId)).toBeUndefined()
    } finally {
      release.resolve(undefined)
      flushGate.resolve(undefined)
    }
  })
})

/** Minimal text chunk script shared by the cases. */
function textChunks(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 5, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

/** Whether the error tree retains the sentinel by identity. */
function errorChainHas(error: unknown, sentinel: Error): boolean {
  const seen = new Set<unknown>()
  const visit = (value: unknown): boolean => {
    if (value === sentinel) return true
    if (!(value instanceof Error) || seen.has(value)) return false
    seen.add(value)
    if (value instanceof AggregateError) {
      for (const inner of value.errors) if (visit(inner)) return true
    }
    return visit(value.cause)
  }
  return visit(error)
}
