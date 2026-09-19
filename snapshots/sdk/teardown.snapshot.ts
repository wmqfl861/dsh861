/**
 * Keyless teardown evidence chain for the production-teardown SDK snapshot
 * scenarios (`subagent-teardown`, `agent-team-teardown`): each case boots the
 * real `dsh --profile sdk` runtime over the scenario's replay composition
 * with its gate/trigger plugin in manual mode, records the pre-close
 * persisted state while the real close is held at the gate, releases the
 * close through the real service entry, observes the SDK terminal
 * notification and the real post-close suffix, then takes over write
 * ownership of the original session directory after the runtime's protocol
 * shutdown. The committed goldens are verified by `sdk.snapshot.ts`; this
 * adapter pins the close-triggering evidence chain itself. The Team case also
 * pins the send-delivery fence: the close arms only behind the scenario
 * send's confirmed acceptance, and the same message identity must be durably
 * queued and delivered in the real Lead log before any close-produced event.
 */

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { materializeProfilePatch } from '@deepseek-ai/dsh-session-snapshot'
import { DeepSeekHarness, type HarnessNotification, type NotificationSubscription, type SdkPromptContentBlock } from '@deepseek-ai/dsh-sdk-client'
import { Context } from '@deepseek-ai/cordis'
import type { SessionHandle, SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import { SessionAlreadyOwnedError } from '@deepseek-ai/dsh-session-persistence'
import type { SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'

const corpusRoot = fileURLToPath(new URL('../', import.meta.url))
const ROOT_SESSION_ID = 'fixture-root-session'

/** One persisted session log observed live under the runtime's sessions root. */
interface LiveLog {
  /** Absolute JSONL path inside the original directory. */
  readonly path: string
  /** Header `id` (the persistence claim id). */
  readonly id: string
  /** Whether the header declares a parent session. */
  readonly hasParent: boolean
  /** Raw event lines, header excluded, in stored order. */
  readonly events: string[]
}

/** Facts the scenario trigger plugin publishes while the close is held. */
interface GateState {
  held: boolean
  pendingInbox: number
  parentIdle: boolean
  leadIdle: boolean
  /** Team case only: settlement of the scenario's own `agentTeams.sendMessage`. */
  readonly sendStatus?: string
  /** Team case only: message identity returned by the accepted send. */
  readonly sendMessageId?: string
  /** Team case only: exact reason a send settled without acceptance. */
  readonly sendError?: string
  ready: boolean
  triggered: boolean
  trigger: string
  cancelled: boolean
  closed: boolean
  closeError: string
}

/** One teardown case's scenario-local expectations. */
interface TeardownCase {
  /** Scenario directory under `snapshots/sdk/`. */
  readonly name: 'subagent-teardown' | 'agent-team-teardown'
  /** The root turn the close itself settles (settlement notice) before shutdown. */
  readonly settledRootTurn: number
  /** Whether the close itself appends root-session events. */
  readonly rootSuffix: 'close-produced' | 'empty'
  /** The identity the plugin records for the real close entry. */
  readonly triggerIdentity: string
}

const CASES: readonly TeardownCase[] = [
  {
    name: 'subagent-teardown',
    settledRootTurn: 2,
    rootSuffix: 'close-produced',
    triggerIdentity: 'subagents.drainContinuableChildren',
  },
  {
    name: 'agent-team-teardown',
    settledRootTurn: 2,
    rootSuffix: 'close-produced',
    triggerIdentity: 'subagents.drainContinuableChildren',
  },
]

function parseRecord(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>
}

/** The persisted event `seq` of one raw event line. */
function seqOf(line: string): number {
  const value = parseRecord(line).seq
  if (typeof value !== 'number') throw new Error(`persisted event carries no seq: ${line.slice(0, 120)}`)
  return value
}

async function readLiveLogs(sessionsRoot: string): Promise<LiveLog[]> {
  if (!existsSync(sessionsRoot)) return []
  const files = (await readdir(sessionsRoot, { recursive: true }))
    .filter(name => String(name).endsWith('.jsonl'))
    .map(name => join(sessionsRoot, String(name)))
  return Promise.all(files.map(async (path) => {
    const lines = (await readFile(path, 'utf8')).trimEnd().split('\n')
    const header = parseRecord(lines[0] as string)
    const id = header.id
    if (typeof id !== 'string') throw new Error(`${path}: persisted header carries no id`)
    return { path, id, hasParent: typeof header.parentSession === 'string', events: lines.slice(1) }
  }))
}

function childLogOf(logs: readonly LiveLog[], childId: string): LiveLog {
  const child = logs.find(log => log.id === childId)
  if (child === undefined) throw new Error(`no persisted log for child session ${childId}`)
  return child
}

function rootLogOf(logs: readonly LiveLog[]): LiveLog {
  const root = logs.find(log => !log.hasParent)
  if (root === undefined) throw new Error('no persisted root session log')
  return root
}

/** Events strictly after `seq`, in seq order. */
function suffixAfter(log: LiveLog, seq: number): string[] {
  return log.events.filter(line => seqOf(line) > seq)
}

function eventTypes(events: readonly string[]): string[] {
  return events.map(line => String(parseRecord(line).type))
}

async function readGateState(gateRoot: string): Promise<GateState> {
  return parseRecord(await readFile(join(gateRoot, 'state.json'), 'utf8')) as unknown as GateState
}

/**
 * Poll until the deadline; throws with the last observed state on timeout or
 * as soon as `failed` names a terminal gate failure (a Team send that settled
 * without acceptance never arms, so reporting it beats waiting out the clock).
 */
async function pollGate(
  gateRoot: string,
  what: string,
  done: (state: GateState) => boolean,
  failed?: (state: GateState) => boolean,
): Promise<GateState> {
  const deadline = Date.now() + 60_000
  for (;;) {
    const state = await readGateState(gateRoot)
    if (done(state)) return state
    if (failed !== undefined && failed(state)) {
      throw new Error(`teardown gate: ${what} failed (state: ${JSON.stringify(state)})`)
    }
    if (Date.now() > deadline) {
      throw new Error(`teardown gate: ${what} not reached within 60s (last state: ${JSON.stringify(state)})`)
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}

/**
 * Single consumer for the tree subscription: records subagent lineage
 * notifications and resolves registered waiters in arrival order.
 */
class NotificationTap {
  private readonly waiters: { match: (notification: HarnessNotification) => boolean; resolve: (notification: HarnessNotification) => void }[] = []
  private readonly seen: HarnessNotification[] = []
  readonly finishedChildren = new Set<string>()
  private readonly loop: Promise<void>

  constructor(subscription: NotificationSubscription) {
    this.loop = (async () => {
      try {
        for (;;) {
          const notification = await subscription.next()
          this.seen.push(notification)
          if (notification.method === 'subagent.finished'
            && typeof notification.params.childSessionId === 'string') {
            this.finishedChildren.add(notification.params.childSessionId)
          }
          for (const waiter of [...this.waiters]) {
            if (waiter.match(notification)) {
              this.waiters.splice(this.waiters.indexOf(waiter), 1)
              waiter.resolve(notification)
            }
          }
        }
      } catch {
        // The subscription closes with the runtime; registered waiters that
        // never matched fail through their own deadlines below.
      }
    })()
  }

  /** Resolves once a notification matches; already-seen matches resolve immediately. */
  async waitFor(what: string, match: (notification: HarnessNotification) => boolean): Promise<HarnessNotification> {
    for (let index = this.seen.length - 1; index >= 0; index--) {
      const notification = this.seen[index]
      if (notification !== undefined && match(notification)) return notification
    }
    return await new Promise((resolve, reject) => {
      const waiter = {
        match,
        resolve: (notification: HarnessNotification) => {
          clearTimeout(timer)
          resolve(notification)
        },
      }
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1)
        reject(new Error(`teardown snapshot: ${what} not observed within 60s`))
      }, 60_000).unref()
      this.waiters.push(waiter)
    })
  }

  /** Resolves once the SDK reports the child session finished. */
  waitForChildFinished(childId: string): Promise<void> {
    if (this.finishedChildren.has(childId)) return Promise.resolve()
    return this.waitFor(`subagent.finished for ${childId}`, notification =>
      notification.method === 'subagent.finished' && notification.params.childSessionId === childId,
    ).then(() => undefined)
  }

  /** Resolves on the root session's `turn/end` for `turn`. */
  waitForRootTurnEnd(turn: number): Promise<void> {
    return this.waitFor(`root turn/end ${turn}`, notification => {
      if (notification.method !== 'session.event' || notification.params.sessionId !== ROOT_SESSION_ID) return false
      const event = notification.params.event as Record<string, unknown> | null
      if (event === null || typeof event !== 'object' || event.type !== 'turn/end') return false
      const data = event.data as Record<string, unknown> | undefined
      return data !== undefined && data.turn === turn
    }).then(() => undefined)
  }

  /** Keep the pump referenced until it exits with the subscription. */
  drain(): Promise<void> {
    return this.loop
  }
}

interface TurnAction {
  readonly turn: number
  readonly content: readonly Record<string, unknown>[]
}

/** Root-turn user actions derived from the committed parent fixture. */
function turnActions(parentFixture: string): TurnAction[] {
  const actions: TurnAction[] = []
  let current: TurnAction | undefined
  for (const line of parentFixture.trimEnd().split('\n')) {
    const record = parseRecord(line)
    if (record.type === 'turn/start') {
      const data = record.data as Record<string, unknown> | undefined
      if (typeof data?.turn !== 'number') throw new Error('teardown fixture turn/start has no turn')
      current = { turn: data.turn, content: [] }
      continue
    }
    if (record.type === 'user/message' && current !== undefined && current.content.length === 0) {
      const data = record.data as Record<string, unknown> | undefined
      const source = data?.source as Record<string, unknown> | undefined
      if (source?.kind === 'user' && Array.isArray(data?.content)) {
        current = { turn: current.turn, content: data.content as Record<string, unknown>[] }
      }
      continue
    }
    if (record.type === 'turn/end' && current !== undefined) {
      actions.push(current)
      current = undefined
    }
  }
  return actions
}

/** Replace scenario tokens in one derived turn input. */
function materializeTurn(
  action: TurnAction,
  cwd: string,
  liveSessions: readonly string[],
): SdkPromptContentBlock[] {
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string') {
      let output = value.replaceAll('{{cwd}}', cwd)
      output = output.replace(/\{\{session:([1-9]\d*)\}\}/g, (_token, ordinal: string) => {
        const live = liveSessions[Number(ordinal) - 1]
        if (live === undefined) throw new Error(`teardown turn ${action.turn}: session token ${ordinal} has not bound`)
        return live
      })
      return output
    }
    if (Array.isArray(value)) return value.map(replace)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]))
    }
    return value
  }
  return action.content.map(block => replace(block) as SdkPromptContentBlock)
}

/** The replay route the committed parent fixture pins. */
function routeOf(parentFixture: string): { provider: string; model: string } {
  for (const line of parentFixture.trimEnd().split('\n')) {
    const record = parseRecord(line)
    if (record.type !== 'request/header') continue
    const header = (record.data as Record<string, unknown> | undefined)?.header as Record<string, unknown> | undefined
    const config = header?.config as Record<string, unknown> | undefined
    if (typeof config?.provider === 'string' && typeof config?.model === 'string') {
      return { provider: config.provider, model: config.model }
    }
  }
  throw new Error('teardown fixture has no request model')
}

/** Compose the replay patches for one non-`sdk-` teardown composition. */
function replayPatches(scenarioDir: string): string[] {
  const base = join(corpusRoot, 'session', 'text-turn')
  if (!existsSync(join(base, 'cordis.yml'))) throw new Error('snapshot corpus has no default transport-neutral composition')
  return [
    join(base, 'cordis.yml'),
    join(scenarioDir, 'cordis.snapshot.yml'),
    join(base, 'model.cordis.yml'),
  ]
}

/** Independent single-writer probe over the original sessions directory. */
async function mountProbe(sessionsRoot: string): Promise<{ claim(id: string): Promise<SessionHandle>; dispose(): Promise<void> }> {
  const ctx = new Context()
  await ctx.plugin(JsonlSessionPersistence, { root: sessionsRoot, compression: 'none' })
  const persistence: SessionPersistence = ctx.sessionPersistence
  return {
    claim: id => persistence.open(id as SessionId, 'write'),
    dispose: () => ctx.fiber.dispose(),
  }
}

describe('production-teardown close evidence over dsh --profile sdk', () => {
  for (const testCase of CASES) {
    it(`holds, releases, and observes the real close for ${testCase.name}`, async () => {
      const scenarioDir = join(corpusRoot, 'sdk', testCase.name)
      const cwd = await mkdtemp(join(tmpdir(), `sdk-teardown-${testCase.name}-`))
      const dshHome = join(cwd, '.dsh')
      const sessionsRoot = join(dshHome, 'sessions')
      const gateRoot = join(dshHome, 'teardown-gate')
      const fixtures = ['session.v3.jsonl', 'session.1.v3.jsonl'].map(name => join(scenarioDir, name))
      const fixtureContents = await Promise.all(fixtures.map(file => readFile(file, 'utf8')))
      const route = routeOf(fixtureContents[0] as string)

      const replayRoot = join(cwd, '.replay-fixtures')
      await mkdir(replayRoot, { recursive: true })
      const replayFiles = await Promise.all(fixtures.map(async (file, index) => {
        const destination = join(replayRoot, basename(file))
        // The committed fixtures embed {{cwd}} inside JSON string values, so
        // the hydrated replacement must stay valid JSON: a raw host path
        // whose separator is a backslash would produce illegal JSON escapes.
        const hydratedCwd = JSON.stringify(cwd).slice(1, -1)
        await writeFile(destination, (fixtureContents[index] as string).replaceAll('{{cwd}}', hydratedCwd))
        return destination
      }))
      const patchRoot = join(cwd, '.snapshot-patches')
      await mkdir(patchRoot, { recursive: true })
      const patches = replayPatches(scenarioDir)
        .map((patch, index) => materializeProfilePatch(patch, cwd, patchRoot, index))
      const env: Record<string, string> = {
        ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)) as Record<string, string>,
        DSH_SNAPSHOT: 'replay',
        DSH_SNAPSHOT_PROVIDER: route.provider,
        DSH_SNAPSHOT_MODEL: route.model,
        DSH_TEARDOWN_MANUAL: '1',
        DSH_TELEMETRY_DISABLED: '1',
        DSH_AGENTS_HOME: join(cwd, '.agents'),
        DSH_SNAPSHOT_FILE: replayFiles[0] as string,
        DSH_SNAPSHOT_CHILD_FILES: replayFiles.slice(1).join(delimiter),
        NODE_OPTIONS: [process.env.NODE_OPTIONS, '--disable-warning=ExperimentalWarning'].filter(Boolean).join(' '),
      }
      if (testCase.name === 'agent-team-teardown') {
        env.DSH_SNAPSHOT_OVERRIDE = join(scenarioDir, 'replay.override.json')
      }

      const probe = await mountProbe(sessionsRoot)
      const actions = turnActions(fixtureContents[0] as string)
      const liveSessions: string[] = [ROOT_SESSION_ID]
      const harness = new DeepSeekHarness({
        profile: 'sdk',
        patches,
        dshHome,
        processCwd: cwd,
        env,
        requestTimeoutMs: 110_000,
        cwd,
        provider: route.provider,
        model: route.model,
      })
      try {
        await harness.start()
        const tap = new NotificationTap(harness.client.subscribeSessionTree(ROOT_SESSION_ID))
        const session = harness.session(ROOT_SESSION_ID)

        // Turn 1 establishes the held model call, the pending inbox, and the
        // idle root before the close is armed.
        const first = actions[0]
        if (first === undefined) throw new Error(`${testCase.name}: fixture has no first turn`)
        await session.run(materializeTurn(first, cwd, liveSessions))
        await tap.waitForRootTurnEnd(first.turn)

        // Gate held: the plugin has the real close armed but not fired. The
        // Team case additionally proves the close armed behind a confirmed
        // acceptance of the scenario's own send, and surfaces a send that
        // settled without acceptance immediately instead of timing out.
        const sendFailed = (state: GateState): boolean => state.sendError !== undefined && state.sendError !== ''
        const armed = await pollGate(gateRoot, 'armed close',
          state => state.ready && !state.triggered,
          testCase.name === 'agent-team-teardown' ? sendFailed : undefined)
        expect(armed.held, `${testCase.name}: held model call before close`).toBe(true)
        expect(armed.pendingInbox, `${testCase.name}: pending inbox before close`).toBeGreaterThanOrEqual(1)
        expect(testCase.name === 'agent-team-teardown' ? armed.leadIdle : armed.parentIdle,
          `${testCase.name}: root idle before close`).toBe(true)
        const sendMessageId = armed.sendMessageId
        if (testCase.name === 'agent-team-teardown') {
          expect(armed.sendStatus, `${testCase.name}: close armed behind an accepted send`).toBe('accepted')
          expect(typeof sendMessageId === 'string' && sendMessageId !== '',
            `${testCase.name}: accepted send carries a message identity`).toBe(true)
        }

        const held = parseRecord(await readFile(join(gateRoot, 'held.json'), 'utf8'))
        const childId = testCase.name === 'agent-team-teardown'
          ? String(held.teammateSessionId)
          : String(held.childSessionId)
        liveSessions.push(childId)

        // Pre-close persisted state: epoch, prefix, and last seq per session.
        const preLogs = await readLiveLogs(sessionsRoot)
        expect(preLogs, `${testCase.name}: persisted sessions before close`).toHaveLength(2)
        const preChild = childLogOf(preLogs, childId)
        const preRoot = rootLogOf(preLogs)
        const preChildSeq = (await Promise.all(preChild.events.map(line => seqOf(line)))).at(-1) ?? -1
        const preRootSeq = (await Promise.all(preRoot.events.map(line => seqOf(line)))).at(-1) ?? -1
        expect(eventTypes(preChild.events), `${testCase.name}: child has no cancelled attempt before close`)
          .not.toContain('assistant/attempt')
        const preChildTail = eventTypes(preChild.events).at(-1)
        if (preChildTail === undefined) throw new Error(`${testCase.name}: child log is empty before close`)
        expect(preChildTail, `${testCase.name}: the held child turn is still open before close`)
          .not.toBe('turn/end')
        const secondStep = preChild.events.findLast(line => parseRecord(line).type === 'step/start')
        if (secondStep === undefined) throw new Error(`${testCase.name}: child has no held step before close`)
        const heldStepSeq = seqOf(secondStep)

        // Team case: the confirmed message is durably queued AND delivered in
        // the real Lead log before the close is released; the acceptance the
        // trigger waited for is persisted delivery, not an in-memory flag.
        const teamMessageId = sendMessageId ?? ''
        let deliveredPreSeq = -1
        if (testCase.name === 'agent-team-teardown') {
          const queuedLine = preRoot.events.find(line => {
            const record = parseRecord(line)
            if (record.type !== 'team/message/queued') return false
            const message = (record.data as { message?: { id?: string } }).message
            return message?.id === teamMessageId
          })
          if (queuedLine === undefined) {
            throw new Error(`${testCase.name}: no persisted team/message/queued for message ${teamMessageId}`)
          }
          expect((parseRecord(queuedLine).data as { message: { targetId: string } }).message.targetId,
            `${testCase.name}: queued message targets the teammate`).toBe(childId)
          const deliveredLine = preRoot.events.find(line => {
            const record = parseRecord(line)
            if (record.type !== 'team/message/delivered') return false
            return (record.data as { messageId?: string }).messageId === teamMessageId
          })
          if (deliveredLine === undefined) {
            throw new Error(`${testCase.name}: no persisted team/message/delivered for message ${teamMessageId} before the close`)
          }
          expect((parseRecord(deliveredLine).data as { targetId: string }).targetId,
            `${testCase.name}: delivered message targets the teammate`).toBe(childId)
          deliveredPreSeq = seqOf(deliveredLine)
          expect(deliveredPreSeq, `${testCase.name}: delivery persisted after its queue edge`)
            .toBeGreaterThan(seqOf(queuedLine))
        }

        // While the close is held the live runtime still owns every session's
        // write ownership in the original directory.
        await expect(probe.claim(childId), `${testCase.name}: child write ownership held during close`)
          .rejects.toBeInstanceOf(SessionAlreadyOwnedError)
        await expect(probe.claim(ROOT_SESSION_ID), `${testCase.name}: root write ownership held during close`)
          .rejects.toBeInstanceOf(SessionAlreadyOwnedError)

        // Release: the plugin fires the real service entry and observes the
        // cancel handshake and the close settlement itself.
        await writeFile(join(gateRoot, 'trigger'), '')
        const settled = await pollGate(gateRoot, 'settled close',
          state => state.triggered && state.cancelled && state.closed)
        expect(settled.trigger, `${testCase.name}: real close entry identity`)
          .toContain(testCase.triggerIdentity)
        expect(settled.closeError, `${testCase.name}: real close settled without error`).toBe('')

        // The SDK terminal notification arrives while the subscription lives.
        await tap.waitForChildFinished(childId)
        if (testCase.settledRootTurn > 0) {
          // The close itself settles the background child: the runtime delivers
          // the stopped-notice turn on the live root session.
          await tap.waitForRootTurnEnd(testCase.settledRootTurn)
        }

        // Protocol shutdown: the spec never terminates the runtime itself.
        await harness.close()

        // Post-close state: real appended suffix per session from the original
        // directory, and contiguous final seq.
        const postLogs = await readLiveLogs(sessionsRoot)
        expect(postLogs, `${testCase.name}: persisted sessions after close`).toHaveLength(2)
        const postChild = childLogOf(postLogs, childId)
        const postRoot = rootLogOf(postLogs)
        const childSuffix = suffixAfter(postChild, preChildSeq)
        const rootSuffix = suffixAfter(postRoot, preRootSeq)
        expect(childSuffix.length, `${testCase.name}: child close suffix is non-empty`).toBeGreaterThan(0)
        const childTypes = eventTypes(childSuffix)
        const attempt = childSuffix.find(line => parseRecord(line).type === 'assistant/attempt')
        if (attempt === undefined) throw new Error(`${testCase.name}: close suffix has no cancelled attempt`)
        const attemptStream = (parseRecord(attempt).data as Record<string, unknown> | undefined)?.stream
        expect(Array.isArray(attemptStream) && attemptStream.length,
          `${testCase.name}: cancelled attempt forwarded no chunks`).toBe(0)
        const terminalEnds = childSuffix.filter(line => parseRecord(line).type === 'turn/end')
        expect(terminalEnds, `${testCase.name}: exactly one child terminal`).toHaveLength(1)
        const reason = (parseRecord(terminalEnds[0] as string).data as Record<string, unknown> | undefined)?.reason
        expect(reason, `${testCase.name}: child terminal carries the parent cancel`).toEqual({
          kind: 'aborted',
          reason: { kind: 'parent' },
        })
        const childSeqs = await Promise.all(postChild.events.map(line => seqOf(line)))
        expect(childSeqs.at(-1), `${testCase.name}: child final seq is contiguous`)
          .toBe(preChildSeq + childSuffix.length)
        expect(childTypes.includes('step/end'), `${testCase.name}: held step closed`).toBe(true)
        // The pending inbox lands (persisted insert) behind the held step by
        // the final state: the plugin queues it while the call is held and
        // the close persists the splice alongside the cancelled step.
        const pendingInserts = postChild.events
          .filter(line => seqOf(line) > heldStepSeq)
          .filter(line => {
            const record = parseRecord(line)
            if (record.type !== 'agent/inbox/spliced') return false
            const inserted = (record.data as Record<string, unknown> | undefined)?.inserted
            return Array.isArray(inserted) && inserted.length > 0
          })
        expect(pendingInserts.length, `${testCase.name}: pending inbox landed behind the held call`)
          .toBeGreaterThanOrEqual(1)
        if (testCase.name === 'agent-team-teardown') {
          const pendingIsTheSentMessage = postChild.events
            .filter(line => seqOf(line) > heldStepSeq)
            .some(line => {
              const record = parseRecord(line)
              if (record.type !== 'agent/inbox/spliced') return false
              const inserted = (record.data as { inserted?: { source?: { kind?: string; messageId?: string } }[] }).inserted
              return Array.isArray(inserted) && inserted.some(item => item.source?.kind === 'team-message'
                && item.source.messageId === teamMessageId)
            })
          expect(pendingIsTheSentMessage,
            `${testCase.name}: the confirmed message itself is the pending inbox content behind the held step`).toBe(true)
        }
        if (testCase.rootSuffix === 'empty') {
          expect(rootSuffix, `${testCase.name}: the close appends no root events`).toEqual([])
        } else {
          expect(rootSuffix.length, `${testCase.name}: the close produced root settlement events`).toBeGreaterThan(0)
          const rootEnds = rootSuffix.filter(line => parseRecord(line).type === 'turn/end')
          const finalEnd = rootEnds.at(-1)
          if (finalEnd === undefined) throw new Error(`${testCase.name}: settlement turn has no turn/end`)
          expect((parseRecord(finalEnd).data as { turn?: number }).turn,
            `${testCase.name}: the close settled the background child on the root session`)
            .toBe(testCase.settledRootTurn)
        }
        if (testCase.name === 'agent-team-teardown') {
          const firstCloseSeq = rootSuffix.length > 0 ? seqOf(rootSuffix[0] as string) : Number.POSITIVE_INFINITY
          expect(deliveredPreSeq, `${testCase.name}: delivery precedes every close-produced root event`)
            .toBeLessThan(firstCloseSeq)
        }
        const postReads = await Promise.all(postLogs.map(log => readFile(log.path, 'utf8')))

        // Takeover: after the real shutdown the original directory accepts a
        // new single writer per session; the takeover close appends nothing.
        const handles: SessionHandle[] = []
        for (const id of [ROOT_SESSION_ID, childId]) {
          handles.push(await probe.claim(id))
        }
        for (const handle of handles) await handle[Symbol.asyncDispose]()
        const takeoverLogs = await readLiveLogs(sessionsRoot)
        expect(takeoverLogs, `${testCase.name}: sessions after takeover close`).toHaveLength(2)
        const takeoverReads = await Promise.all(takeoverLogs.map(log => readFile(log.path, 'utf8')))
        expect(takeoverReads, `${testCase.name}: takeover close appended nothing`).toEqual(postReads)

        // Evidence line for the repo-external run log.
        console.info(`teardown-snapshot ${testCase.name}: child ${childId} pre-seq ${preChildSeq} -> post-seq ${childSeqs.at(-1)}, root pre-seq ${preRootSeq} -> suffix ${rootSuffix.length} events, takeover claims 2, notifications ${tap.finishedChildren.size}${testCase.name === 'agent-team-teardown' ? `, team message ${teamMessageId} delivered@${deliveredPreSeq} before the close suffix` : ''}`)
        await tap.drain()
      } finally {
        await harness.close()
        await probe.dispose()
        const dumpRoot = process.env.DSH_TEARDOWN_DUMP
        if (dumpRoot !== undefined && dumpRoot !== '' && existsSync(sessionsRoot)) {
          await mkdir(dumpRoot, { recursive: true })
          for (const log of await readLiveLogs(sessionsRoot)) {
            const relative = log.path.slice(sessionsRoot.length).replaceAll('\\', '-').replaceAll('/', '-')
            await writeFile(join(dumpRoot, `${testCase.name}-${relative}`), await readFile(log.path, 'utf8'))
          }
        }
        await rm(cwd, { recursive: true, force: true })
      }
    })
  }
})
