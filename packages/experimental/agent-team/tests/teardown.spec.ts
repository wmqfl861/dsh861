/**
 * R44 Agent Teams teardown ownership (plan.v1 §9.3).
 *
 * Every case drives the real stack — Cordis, AgentLoop, persistence, the
 * subagent runtime, and the Team service — through public entries and real
 * fiber disposal. Gates are deferreds released in `finally`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Fiber } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SubagentService from '@deepseek-ai/dsh-subagent'
import * as SubagentSpawn from '@deepseek-ai/dsh-subagent-spawn-in-process'
import { MockAdapter } from '../../../core/agent-loop/tests/mock-adapter.ts'
import TeamService from '../src/index.ts'
import { teamProjectionDefinition } from '../src/projection.ts'
import { TestSessionQuery } from './test-session-query.ts'

const SIGNAL = new AbortController().signal
const roots: string[] = []
const gates: PromiseWithResolvers<undefined>[] = []
const contexts: Context[] = []

afterEach(async () => {
  for (const gate of gates.splice(0)) gate.resolve(undefined)
  const failures: unknown[] = []
  for (const ctx of contexts.splice(0)) {
    try { await ctx.fiber.dispose() } catch (error) { failures.push(error) }
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  if (failures.length > 0) throw new AggregateError(failures, 'teardown fixture contexts failed to settle')
})

interface Harness {
  ctx: Context
  lead: Agent
  adapter: MockAdapter
  teamFiber: Fiber
  root: string
  /** Captured before any unload: service lookups fail once the root unloads. */
  projections: Context['sessionProjections']
}

/** Boot the Team stack; script entries may be gated by the caller. */
async function harness(
  script: ConstructorParameters<typeof MockAdapter>[0],
  watchPlugins?: (fiber: Fiber) => void,
): Promise<Harness> {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  const root = mkdtempSync(join(tmpdir(), 'dsh-team-teardown-'))
  roots.push(root)
  await ctx.plugin(JsonlSessionPersistence, { root })
  await ctx.plugin(TestSessionQuery)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(SubagentService)
  await ctx.plugin(SubagentSpawn, { providerName: 'spawn' })
  const stopWatching = watchPlugins === undefined ? undefined : ctx.on('internal/plugin', watchPlugins)
  const teamFiber = await ctx.plugin(TeamService, { disposalTimeoutMs: 25 })
  stopWatching?.()
  const adapter = new MockAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  const lead = await ctx.agentLoop.create(SessionId('lead'), { provider: 'mock', model: 'mock' })
  return { ctx, lead, adapter, teamFiber, root, projections: ctx.sessionProjections }
}

/** Spawn one teammate through the real tool path. */
async function spawnMember(hs: Harness, name: string) {
  return hs.ctx.agentTeams.spawnTeammate(hs.lead, {
    name,
    description: `${name} worker`,
    prompt: [{ type: 'text', text: `${name} work` }],
    context: 'fresh',
    provider: 'spawn',
    signal: SIGNAL,
  })
}

/** A gated 'hang' script entry the afterEach releases. */
function hang(): 'hang' {
  return 'hang'
}

/** Wait until the agent registry holds the exact live member. */
async function waitRunning(hs: Harness, id: SessionId): Promise<void> {
  await vi.waitFor(() => {
    const agent = hs.ctx.agents.get(id)
    expect(agent?.status).toBe('running')
  }, { timeout: 5_000 })
}

describe('R44 Agent Teams teardown', () => {
  it('R44-T01 a single Team HMR stops active members and a remount recovers the roster', { timeout: 30_000 }, async () => {
    const hs = await harness([hang()])
    const spawned = await spawnMember(hs, 'worker')
    await waitRunning(hs, spawned.member.id)

    await hs.teamFiber.dispose()
    expect(hs.ctx.get('agentTeams')).toBeUndefined()
    await vi.waitFor(() => { expect(hs.ctx.agents.get(spawned.member.id)).toBeUndefined() })

    // The durable roster replays for the same Lead on remount.
    const remounted = await hs.ctx.plugin(TeamService, {})
    const membership = remounted.ctx.get('agentTeams')!.tryMembership(hs.lead)
    expect(membership).toBeDefined()
    expect(hs.ctx.agentTeams.listMembers(hs.lead).some(row => row.id === spawned.member.id)).toBe(true)
    await remounted.dispose()
  })

  it('R44-T02 root unload keeps the projection through the drain and releases it afterwards', { timeout: 30_000 }, async () => {
    // The projection owner is a dedicated child fiber; observe its exact
    // lifecycle directly, because cross-service reads are unreliable while
    // the root unloads.
    let ownerFiber: Fiber | undefined
    const hs = await harness([hang()], (fiber) => {
      if (fiber.name === 'agentTeamProjectionOwner') ownerFiber = fiber
    })
    const spawned = await spawnMember(hs, 'held')
    await waitRunning(hs, spawned.member.id)
    // An admitted-but-unfinished creation gates the close BEFORE its roster
    // sampling, so the projection's last legitimate use happens strictly
    // after the gate — the exact window the old root registration lost.
    const gate = Promise.withResolvers<undefined>()
    gates.push(gate)
    const internal = hs.ctx.agentTeams as unknown as {
      roster: { inFlightCreations: Set<Promise<unknown>> }
    }
    internal.roster.inFlightCreations.add(gate.promise.then(() => undefined))
    const logged: unknown[] = []
    const logger = hs.ctx.logger
    Object.assign(logger, { error: ((value: unknown) => { logged.push(value) }) as typeof logger.error })

    try {
      expect(ownerFiber).toBeDefined()
      expect(ownerFiber!.uid).not.toBeNull()
      const unloading = hs.ctx.fiber.dispose()
      await new Promise((resolve) => { setTimeout(resolve, 100) })
      // The admitted creation keeps its hold: the root unload is unfinished
      // and the projection owner is still live behind the gated close.
      let rootSettled = false
      void unloading.then(() => { rootSettled = true }, () => { rootSettled = true })
      expect(rootSettled).toBe(false)
      expect(ownerFiber!.uid).not.toBeNull()

      gate.resolve(undefined)
      await unloading
      // The roster sampling ran with its projection: no revocation raced it,
      // and the owner left only with the completed close.
      expect(logged.filter(entry => String(entry).includes('Agent Teams projection'))).toEqual([])
      expect(ownerFiber!.uid).toBeNull()
      expect(hs.projections.stateOf(hs.lead.session, 'agentTeam')).toBeUndefined()
    } finally {
      gate.resolve(undefined)
    }
  })

  it('R44-T03 concurrent Team, subagent, and factory closes share the one cleanup', { timeout: 30_000 }, async () => {
    const hs = await harness([hang()])
    const spawned = await spawnMember(hs, 'shared')
    await waitRunning(hs, spawned.member.id)
    const agentsBefore = hs.ctx.agents
    const subagentsFiber = (hs.ctx.subagents as unknown as { ctx: { fiber: Fiber } }).ctx.fiber
    const loopFiber = (hs.ctx.agentLoop as unknown as { ctx: { fiber: Fiber } }).ctx.fiber

    await Promise.all([hs.teamFiber.dispose(), subagentsFiber.dispose(), loopFiber.dispose()])
    await vi.waitFor(() => { expect(agentsBefore.get(spawned.member.id)).toBeUndefined() })
    expect(hs.ctx.get('agentTeams')).toBeUndefined()
  })

  it('R44-T04 the close waits admitted creations and dispatches it already accepted', { timeout: 30_000 }, async () => {
    const hs = await harness([hang()])
    const gate = Promise.withResolvers<undefined>()
    gates.push(gate)
    // One admitted-but-unfinished creation through the roster's real set.
    const internal = hs.ctx.agentTeams as unknown as {
      roster: { inFlightCreations: Set<Promise<unknown>> }
      closeRuntime(): Promise<void>
    }
    internal.roster.inFlightCreations.add(gate.promise.then(() => undefined))

    const closure = internal.closeRuntime()
    let settled = false
    void closure.then(() => { settled = true }, () => { settled = true })
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    expect(settled).toBe(false)

    gate.resolve(undefined)
    const failure = await closure.then(
      () => undefined,
      (error: unknown) => error,
    )
    // The deadline was exceeded and reported; the close still waited the real
    // admission and completed afterwards.
    expect(failure).toBeInstanceOf(AggregateError)
  })

  it('R44-T05 repeated and concurrent closes join the one runtime closure', { timeout: 30_000 }, async () => {
    const hs = await harness([hang()])
    const spawned = await spawnMember(hs, 'idempotent')
    await waitRunning(hs, spawned.member.id)
    const gate = Promise.withResolvers<undefined>()
    gates.push(gate)
    vi.spyOn(hs.ctx.subagents, 'drainContinuableChildren')
      .mockImplementation(() => gate.promise.then(() => undefined))
    const internal = hs.ctx.agentTeams as unknown as { closeRuntime(): Promise<void> }

    const first = internal.closeRuntime()
    const second = internal.closeRuntime()
    const third = internal.closeRuntime()
    expect(second).toBe(first)
    expect(third).toBe(first)
    // Let the configured deadline pass while the drain still holds.
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    gate.resolve(undefined)
    // The deadline was exceeded while the drain held: reported as the close's
    // real failure, once, through the one shared closure.
    const failure = await first.then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(AggregateError)
    await hs.teamFiber.dispose()
  })

  it('R44-T06 one member drain sentinel does not skip the other members or the projection release', { timeout: 30_000 }, async () => {
    const hs = await harness([hang(), 'hang'])
    const failing = await spawnMember(hs, 'failing')
    const healthy = await spawnMember(hs, 'healthy')
    await waitRunning(hs, failing.member.id)
    await waitRunning(hs, healthy.member.id)
    const sentinel = new Error('R44-T06 drain sentinel')
    const failingAgent = hs.ctx.agents.get(failing.member.id)!
    const inbox = failingAgent.inbox
    const realClear = inbox.clear.bind(inbox)
    Object.assign(inbox, {
      clear: (): void => {
        realClear()
        throw sentinel
      },
    })

    const unloading = hs.teamFiber.dispose()
    const failure = await new Promise<unknown>((resolve) => {
      unloading.then(() => { resolve(undefined) }, (reason: unknown) => { resolve(reason) })
    })
    void failure
    // Both members stopped and were released despite the sentinel; the
    // service left and the projection went with it.
    await vi.waitFor(() => {
      expect(hs.ctx.agents.get(failing.member.id)).toBeUndefined()
      expect(hs.ctx.agents.get(healthy.member.id)).toBeUndefined()
    })
    expect(hs.ctx.get('agentTeams')).toBeUndefined()
    inbox.clear = realClear
  })

  it('R44-T07 a past-deadline stuck member keeps ownership until its real release', { timeout: 30_000 }, async () => {
    const hs = await harness([hang()])
    const spawned = await spawnMember(hs, 'stuck')
    await waitRunning(hs, spawned.member.id)
    const agentsBefore = hs.ctx.agents
    const gate = Promise.withResolvers<undefined>()
    gates.push(gate)
    vi.spyOn(hs.ctx.subagents, 'drainContinuableChildren')
      .mockImplementation(() => gate.promise.then(() => undefined))

    const unloading = hs.teamFiber.dispose()
    await new Promise((resolve) => { setTimeout(resolve, 100) })
    // Past the configured deadline the close is unfinished; the projection
    // and the member's ownership are retained, not declared successful.
    expect(hs.projections.stateOf(hs.lead.session, 'agentTeam')).toBeDefined()
    expect(agentsBefore.get(spawned.member.id)).toBeDefined()

    // The real release completes the close.
    gate.resolve(undefined)
    await unloading
    expect(hs.ctx.get('agentTeams')).toBeUndefined()
  })

  it('R44-T08 the projection stays owned while the service lives and leaves with it', { timeout: 30_000 }, async () => {
    const hs = await harness([])
    // An extra registration cannot evict the service's own projection ref:
    // operations keep working while the service lives.
    const extra = hs.ctx.sessionProjections.register(teamProjectionDefinition)
    extra()
    expect(() => hs.ctx.agentTeams.listMembers(hs.lead)).not.toThrow()

    await hs.teamFiber.dispose()
    expect(hs.projections.stateOf(hs.lead.session, 'agentTeam')).toBeUndefined()
  })
})
