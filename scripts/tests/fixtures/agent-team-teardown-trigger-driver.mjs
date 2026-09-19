/**
 * Test-owned subprocess driver for the agent-team-teardown trigger spec.
 *
 * Imports the actual repository module `snapshots/sdk/agent-team-teardown/teardown-trigger.mjs`
 * (never a transcribed copy; the result records the module path and its SHA-256
 * and git-blob identity), applies it over a fake Context whose services are
 * scenario-controlled deferreds, and drives the causal orderings the spec
 * asserts: inbox insertion before send settlement, acceptance before the
 * remaining ready conditions, queued/reject/invalid settlements, an unrelated
 * child, duplicate events, a pre-existing manual trigger file, the held call's
 * abort handshake, and a real close error. Every scenario runs in its own fresh
 * random directory (the driver process chdirs there; the vitest worker never
 * chdirs) and releases its deferreds, held iterators, disposers, and temp
 * directory in a finally block. Results go to the caller-supplied result JSON
 * path; the exit code is 0 only when every scenario passes.
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const triggerUrl = new URL('../../../snapshots/sdk/agent-team-teardown/teardown-trigger.mjs', import.meta.url)
const triggerPath = fileURLToPath(triggerUrl)
const triggerBytes = readFileSync(triggerPath)
const triggerModule = {
  path: triggerPath,
  sha256: createHash('sha256').update(triggerBytes).digest('hex'),
  blob: createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${triggerBytes.length}\0`), triggerBytes])).digest('hex'),
  name: '',
}

const LEAD_ID = 'r46-lead-session-0001'
const MATE_ID = 'r46-mate-session-0002'
const OTHER_ID = 'r46-other-child-0003'

const leadAgent = { session: { header: { id: LEAD_ID, parentSession: undefined } } }
const mateAgent = { session: { header: { id: MATE_ID, parentSession: LEAD_ID } } }
const otherAgent = { session: { header: { id: OTHER_ID, parentSession: LEAD_ID } } }

/** Deferred promise handle so scenarios control settlement order explicitly. */
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** Two macrotask boundaries: every microtask queued by a settlement runs first. */
const flush = async () => {
  for (let i = 0; i < 2; i++) await new Promise(resolve => setTimeout(resolve, 0))
}

/** Bounded poll for timer-driven facts (the manual path polls on a 20ms interval). */
const waitFor = async (what, predicate, deadlineMs = 5_000) => {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const value = predicate()
    if (value) return value
    if (Date.now() > deadline) throw new Error(`driver waitFor timed out: ${what}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

/** Bounded observation window: a timer-driven path had ample time to misfire. */
const settle = ms => new Promise(resolve => setTimeout(resolve, ms))

/** One scenario's fake runtime: minimal Context surface the trigger touches. */
const makeFakeContext = () => {
  const handlers = new Map()
  const disposers = []
  const sendCalls = []
  const drainCalls = []
  let sendImpl = () => deferred().promise
  let drainImpl = () => deferred().promise
  const on = (type, handler) => {
    const list = handlers.get(type) ?? []
    list.push(handler)
    handlers.set(type, list)
    return () => {
      const current = handlers.get(type) ?? []
      const index = current.indexOf(handler)
      if (index >= 0) current.splice(index, 1)
    }
  }
  return {
    handlers,
    on,
    effect: factory => {
      const dispose = factory()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    runDisposers: () => { for (const dispose of disposers) dispose() },
    agentTeams: {
      sendMessage: (agent, request) => {
        sendCalls.push({ agentId: agent?.session?.header?.id, target: request?.target })
        return sendImpl()
      },
    },
    subagents: {
      drainContinuableChildren: (agent, ids) => {
        drainCalls.push({ agentId: agent?.session?.header?.id, ids: [...(ids ?? [])] })
        return drainImpl()
      },
    },
    configure: (next) => { ({ send: sendImpl, drain: drainImpl } = next) },
    sendCalls,
    drainCalls,
  }
}

/** Emit one session/event through the registered handlers. */
const emitSessionEvent = (ctx, header, event) => {
  for (const handler of ctx.handlers.get('session/event') ?? []) handler({ header }, event)
}

/** Emit one agent/pre-step and await the waterfall. */
const emitPreStep = async (ctx, agent) => {
  for (const handler of ctx.handlers.get('agent/pre-step') ?? []) await handler({ agent }, async () => undefined)
}

/** Emit one agent/inbox/inserted through the registered handlers. */
const emitInboxInserted = (ctx, agent) => {
  for (const handler of ctx.handlers.get('agent/inbox/inserted') ?? []) handler({ agent })
}

/** Invoke the llm/stream waterfall for one call; returns the resulting stream. */
const callLlm = (ctx, options) => {
  const list = ctx.handlers.get('llm/stream') ?? []
  const dispatch = index => {
    if (index >= list.length) return (async function* () {})()
    return list[index](options, () => dispatch(index + 1))
  }
  return dispatch(0)
}

/** Read the trigger's published gate state from the scenario cwd. */
const readState = () => JSON.parse(readFileSync(join(process.cwd(), '.dsh', 'teardown-gate', 'state.json'), 'utf8'))

/** Run one scenario body with bookkeeping, cleanup, and a fresh random cwd. */
const runScenario = async (name, manual, body) => {
  const originalCwd = process.cwd()
  const workdir = mkdtempSync(join(tmpdir(), 'r46-trigger-'))
  const ctx = makeFakeContext()
  const result = { name, ok: true, error: '', checks: [], timeline: [], drainCalls: [], sendCalls: [], stateFinal: null }
  const check = (checkName, pass, detail) => {
    result.checks.push({ name: checkName, pass: Boolean(pass), detail: detail === undefined ? '' : String(detail) })
  }
  const mark = step => {
    const state = readState()
    result.timeline.push({ step, drain: ctx.drainCalls.length, ready: state.ready, sendStatus: state.sendStatus, sendMessageId: state.sendMessageId, pendingInbox: state.pendingInbox, leadIdle: state.leadIdle })
  }
  const heldControllers = []
  const heldWaiters = []
  const pendingDeferreds = []
  let applyDisposer
  process.chdir(workdir)
  try {
    if (manual) process.env.DSH_TEARDOWN_MANUAL = '1'
    else delete process.env.DSH_TEARDOWN_MANUAL
    const trigger = await import(triggerUrl.href)
    triggerModule.name = trigger.name
    if (trigger.name !== 'agent-team-teardown-trigger' || typeof trigger.apply !== 'function') {
      throw new Error(`unexpected trigger module identity: name=${String(trigger.name)}`)
    }
    applyDisposer = trigger.apply(ctx)
    const h = {
      ctx,
      check,
      mark,
      leadAgent,
      mateAgent,
      otherAgent,
      gated: () => { const gate = deferred(); pendingDeferreds.push(gate); return gate },
      keepHeld: controller => { heldControllers.push(controller) },
      watchHeld: promise => { heldWaiters.push(Promise.resolve(promise).catch(() => undefined)) },
      settleThen: settle,
      waitFor,
    }
    await body(h)
    result.stateFinal = readState()
    result.drainCalls = ctx.drainCalls
    result.sendCalls = ctx.sendCalls
  } catch (error) {
    result.ok = false
    result.error = error instanceof Error ? `${error.message}\n${String(error.stack ?? '').split('\n').slice(1, 4).join('\n')}` : String(error)
  } finally {
    try {
      for (const controller of heldControllers) { if (!controller.signal.aborted) controller.abort() }
      await Promise.all(heldWaiters)
      for (const gate of pendingDeferreds) { gate.resolve(undefined); await gate.promise.catch(() => undefined) }
      if (typeof applyDisposer === 'function') applyDisposer()
      ctx.runDisposers()
      await flush()
    } catch {
      // Cleanup is best effort inside the driver; the spec asserts the
      // scenario results, and a broken cleanup surfaces as scenario errors.
    }
    try { process.chdir(originalCwd) } catch { /* tmpdir itself never disappears mid-run */ }
    try { rmSync(workdir, { recursive: true, force: true }) } catch { /* Windows EBUSY retries are not a scenario fact */ }
  }
  if (result.checks.some(entry => !entry.pass)) result.ok = false
  return result
}

/** Establish the Lead agent, the Lead's authored teammate inbox insert (the
 * production fact that registers the teammate identity before its model calls),
 * and the fenced first teammate call (never iterated: its waitUntil poller is
 * irrelevant to the causal orders under test). */
const openScenario = async h => {
  await emitPreStep(h.ctx, h.leadAgent)
  emitInboxInserted(h.ctx, h.mateAgent)
  callLlm(h.ctx, { sessionId: MATE_ID })
}

/** Open the held second teammate call; the send starts synchronously inside it. */
const openHeldCall = (h, sendGate, drainGate, insertWhilePending) => {
  const controller = new AbortController()
  h.keepHeld(controller)
  h.ctx.configure({
    send: () => {
      if (insertWhilePending) emitInboxInserted(h.ctx, h.mateAgent)
      return sendGate.promise
    },
    drain: () => drainGate.promise,
  })
  const stream = callLlm(h.ctx, { sessionId: MATE_ID, signal: controller.signal })
  h.watchHeld(stream[Symbol.asyncIterator]().next().then(
    () => 'held-stream-completed',
    error => `held-stream-rejected:${error instanceof Error ? error.message : String(error)}`,
  ))
  return { controller, stream }
}

const scenarios = [
  {
    name: 's1-inbox-before-ack',
    manual: false,
    run: async h => {
      await openScenario(h)
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      const sendGate = h.gated()
      const drainGate = h.gated()
      openHeldCall(h, sendGate, drainGate, true)
      await flush()
      h.check('held-before-settle', readState().held === true && readState().heldCall === 2, JSON.stringify({ held: readState().held, heldCall: readState().heldCall }))
      h.check('send-still-pending-before-settle', readState().sendStatus === '' && h.ctx.sendCalls.length === 1, JSON.stringify({ sendStatus: readState().sendStatus, sends: h.ctx.sendCalls.length }))
      h.check('no-close-while-send-pending', h.ctx.drainCalls.length === 0, `drain calls while pending: ${h.ctx.drainCalls.length}`)
      h.mark('pending')
      sendGate.resolve({ messageId: 'team-message-s1', status: 'accepted' })
      await flush()
      h.check('close-exactly-once-after-acceptance', h.ctx.drainCalls.length === 1, `drain calls after acceptance: ${h.ctx.drainCalls.length}`)
      h.check('accepted-identity-recorded', readState().sendStatus === 'accepted' && readState().sendMessageId === 'team-message-s1' && readState().sendError === '', JSON.stringify({ sendStatus: readState().sendStatus, sendMessageId: readState().sendMessageId, sendError: readState().sendError }))
      h.check('drain-targets-exact-teammate', h.ctx.drainCalls.length === 1 && h.ctx.drainCalls[0].agentId === LEAD_ID && h.ctx.drainCalls[0].ids.join(',') === MATE_ID, JSON.stringify(h.ctx.drainCalls))
      h.mark('accepted')
    },
  },
  {
    name: 's2-ack-before-conditions',
    manual: false,
    run: async h => {
      await openScenario(h)
      const sendGate = h.gated()
      const drainGate = h.gated()
      openHeldCall(h, sendGate, drainGate, false)
      await flush()
      sendGate.resolve({ messageId: 'team-message-s2', status: 'accepted' })
      await flush()
      h.check('no-close-on-acceptance-alone', h.ctx.drainCalls.length === 0 && readState().ready === false, `drain calls: ${h.ctx.drainCalls.length}, ready: ${readState().ready}`)
      h.mark('accepted-no-inbox')
      emitInboxInserted(h.ctx, h.mateAgent)
      await flush()
      h.check('no-close-without-lead-idle', h.ctx.drainCalls.length === 0, `drain calls after inbox: ${h.ctx.drainCalls.length}`)
      h.mark('inbox')
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      await flush()
      h.check('close-exactly-once-after-conditions', h.ctx.drainCalls.length === 1, `drain calls after lead idle: ${h.ctx.drainCalls.length}`)
      h.check('accepted-reaches-ready', readState().ready === true && readState().sendStatus === 'accepted', JSON.stringify({ ready: readState().ready, sendStatus: readState().sendStatus }))
      h.mark('closed')
    },
  },
  {
    name: 's3-queued',
    manual: false,
    run: async h => {
      await openScenario(h)
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      const sendGate = h.gated()
      const drainGate = h.gated()
      openHeldCall(h, sendGate, drainGate, true)
      await flush()
      h.check('no-close-while-send-pending', h.ctx.drainCalls.length === 0, `drain calls while pending: ${h.ctx.drainCalls.length}`)
      sendGate.resolve({ messageId: 'team-message-s3', status: 'queued' })
      await flush()
      await flush()
      h.check('no-close-on-queued', h.ctx.drainCalls.length === 0 && readState().ready === false, `drain calls: ${h.ctx.drainCalls.length}, ready: ${readState().ready}`)
      h.check('queued-reported-as-not-accepted', readState().sendStatus === 'queued' && readState().sendError.includes('queued') && readState().sendMessageId === 'team-message-s3', JSON.stringify({ sendStatus: readState().sendStatus, sendError: readState().sendError, sendMessageId: readState().sendMessageId }))
      h.mark('queued')
    },
  },
  {
    name: 's4-reject',
    manual: false,
    run: async h => {
      await openScenario(h)
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      const sendGate = h.gated()
      const drainGate = h.gated()
      openHeldCall(h, sendGate, drainGate, true)
      await flush()
      h.check('no-close-while-send-pending', h.ctx.drainCalls.length === 0, `drain calls while pending: ${h.ctx.drainCalls.length}`)
      sendGate.reject(new Error('fake TEAM_DISPOSED for s4'))
      await flush()
      await flush()
      h.check('no-close-on-reject', h.ctx.drainCalls.length === 0 && readState().ready === false, `drain calls: ${h.ctx.drainCalls.length}, ready: ${readState().ready}`)
      h.check('reject-reason-preserved', readState().sendStatus === 'rejected' && readState().sendError.includes('fake TEAM_DISPOSED for s4'), JSON.stringify({ sendStatus: readState().sendStatus, sendError: readState().sendError }))
      h.mark('rejected')
    },
  },
  {
    name: 's5-invalid-identity',
    manual: false,
    run: async h => {
      await openScenario(h)
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      const sendGate = h.gated()
      const drainGate = h.gated()
      openHeldCall(h, sendGate, drainGate, true)
      await flush()
      h.check('no-close-while-send-pending', h.ctx.drainCalls.length === 0, `drain calls while pending: ${h.ctx.drainCalls.length}`)
      sendGate.resolve({ status: 'accepted', messageId: '' })
      await flush()
      await flush()
      h.check('no-close-on-invalid-identity', h.ctx.drainCalls.length === 0 && readState().ready === false, `drain calls: ${h.ctx.drainCalls.length}, ready: ${readState().ready}`)
      h.check('invalid-identity-reported', readState().sendStatus === 'invalid' && readState().sendError.length > 0 && readState().sendMessageId === '', JSON.stringify({ sendStatus: readState().sendStatus, sendError: readState().sendError, sendMessageId: readState().sendMessageId }))
      h.mark('invalid')
    },
  },
  {
    name: 's6-manual-early-trigger',
    manual: true,
    run: async h => {
      const { writeFileSync, mkdirSync, existsSync } = await import('node:fs')
      const { join: joinPath } = await import('node:path')
      const gateRoot = joinPath(process.cwd(), '.dsh', 'teardown-gate')
      mkdirSync(gateRoot, { recursive: true })
      writeFileSync(joinPath(gateRoot, 'trigger'), '')
      if (!existsSync(joinPath(gateRoot, 'trigger'))) throw new Error('manual trigger file did not land')
      await openScenario(h)
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      const sendGate = h.gated()
      const drainGate = h.gated()
      openHeldCall(h, sendGate, drainGate, false)
      await flush()
      emitInboxInserted(h.ctx, h.otherAgent)
      await flush()
      h.check('unrelated-child-not-counted', readState().pendingInbox === 0, `pendingInbox after unrelated child insert: ${readState().pendingInbox}`)
      emitInboxInserted(h.ctx, h.mateAgent)
      emitInboxInserted(h.ctx, h.mateAgent)
      await flush()
      h.check('teammate-inserts-counted', readState().pendingInbox === 2, `pendingInbox after duplicate teammate inserts: ${readState().pendingInbox}`)
      await h.settleThen(300)
      h.check('no-close-before-ack-despite-trigger-file', h.ctx.drainCalls.length === 0, `drain calls before ack with trigger file present: ${h.ctx.drainCalls.length}`)
      h.mark('pre-ack')
      sendGate.resolve({ messageId: 'team-message-s6', status: 'accepted' })
      await h.waitFor('manual drain after acceptance', () => h.ctx.drainCalls.length === 1)
      h.check('manual-close-exactly-once-after-ack', h.ctx.drainCalls.length === 1, `drain calls after ack: ${h.ctx.drainCalls.length}`)
      h.check('drain-targets-exact-teammate', h.ctx.drainCalls[0].ids.join(',') === MATE_ID && h.ctx.drainCalls[0].agentId === LEAD_ID, JSON.stringify(h.ctx.drainCalls))
      await h.settleThen(300)
      h.check('duplicate-polls-do-not-double-close', h.ctx.drainCalls.length === 1, `drain calls after duplicate poll window: ${h.ctx.drainCalls.length}`)
      h.mark('closed')
    },
  },
  {
    name: 's7-abort-and-close-error',
    manual: false,
    run: async h => {
      await openScenario(h)
      emitSessionEvent(h.ctx, { id: LEAD_ID, parentSession: undefined }, { type: 'turn/end', data: { turn: 1 } })
      const sendGate = h.gated()
      const drainGate = h.gated()
      const held = openHeldCall(h, sendGate, drainGate, true)
      await flush()
      sendGate.resolve({ messageId: 'team-message-s7', status: 'accepted' })
      await flush()
      h.check('close-exactly-once-after-acceptance', h.ctx.drainCalls.length === 1, `drain calls after acceptance: ${h.ctx.drainCalls.length}`)
      held.controller.abort()
      await flush()
      h.check('abort-handshake-preserved', readState().cancelled === true, `cancelled after abort: ${readState().cancelled}`)
      drainGate.reject(new Error('close failed s7'))
      await flush()
      h.check('close-error-preserved', readState().closed === true && readState().closeError.includes('close failed s7'), JSON.stringify({ closed: readState().closed, closeError: readState().closeError }))
      h.mark('close-error')
    },},
]

const main = async () => {
  const [resultPath] = process.argv.slice(2)
  if (resultPath === undefined || resultPath === '') {
    process.stderr.write('driver requires a result JSON path argument\n')
    process.exitCode = 2
    return
  }
  const { writeFileSync } = await import('node:fs')
  const results = []
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario.name, scenario.manual, scenario.run))
  }
  const ok = results.every(result => result.ok)
  const payload = JSON.stringify({ ok, module: triggerModule, scenarios: results }, null, 2)
  writeFileSync(resultPath, `${payload}\n`, 'utf8')
  process.stdout.write(payload)
  if (!ok) process.exitCode = 1
}

await main()
