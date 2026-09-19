import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'agent-team-teardown-trigger'
export const inject = ['llm', 'agents', 'subagents', 'agentTeams']

/**
 * Scenario-local gate and trigger for the agent-team-teardown snapshot.
 *
 * The Lead's authored transcript spawns one fresh teammate and sends it one
 * message; the teammate consumes that message into a held model call, and a
 * scenario-authored team message stays PENDING in the teammate's inbox while
 * the call is held. This plugin makes that ordering deterministic and then
 * closes the teammate through the real production service entry:
 *
 *  - the teammate's first step waits until both the spawn prompt and the
 *    Lead's message are accepted, so the teammate consumes the message into
 *    a second step of the same turn on every runner.
 *  - the teammate's SECOND model call is replaced by a hang that waits for
 *    the request's own abort signal (the same contract as an llm-replay
 *    `hang` entry; no chunks are forwarded, so the cancelled turn persists
 *    no assistant message). `.dsh/teardown-gate/held.json` marks the hold.
 *  - once the hold is open, the plugin queues one real team message to the
 *    teammate (`agentTeams.sendMessage`, the mailbox the model tool uses) —
 *    the pending-inbox fact — which the held step can never consume.
 *  - once (held call + pending inbox + idle Lead) all hold, the plugin calls
 *    `subagents.drainContinuableChildren(lead, [teammateId])` — the real
 *    child close — either immediately (auto mode) or after the test process
 *    creates `.dsh/teardown-gate/trigger` (manual mode). The Team runtime's
 *    own close transaction still runs afterwards through the real root
 *    unload at runtime shutdown.
 *  - `.dsh/teardown-gate/state.json` records the observed facts (hold,
 *    pending inbox, idle Lead, trigger identity, cancel handshake, close
 *    settlement) for the teardown snapshot adapter.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - the booted runtime context.
 */
export function apply(ctx) {
  const gateRoot = join(process.cwd(), '.dsh', 'teardown-gate')
  mkdirSync(gateRoot, { recursive: true })
  const manual = process.env.DSH_TEARDOWN_MANUAL === '1'
  const state = {
    sessionEvents: 0,
    preSteps: 0,
    inboxInserted: 0,
    llmCalls: [],
    held: false,
    heldCall: 0,
    pendingQueued: false,
    pendingInbox: 0,
    leadIdle: false,
    ready: false,
    triggered: false,
    trigger: '',
    cancelled: false,
    closed: false,
    closeError: '',
  }
  const publish = () => {
    writeFileSync(join(gateRoot, 'state.json'), `${JSON.stringify(state)}\n`)
  }
  publish()

  let lead
  let teammateId
  let queued = false

  const callsBySession = new Map()
  ctx.on('llm/stream', (options, next) => {
    const key = options.sessionId === undefined ? '\0anon\0' : String(options.sessionId)
    const call = (callsBySession.get(key) ?? 0) + 1
    callsBySession.set(key, call)
    state.llmCalls.push(`${key === '\0anon\0' ? 'anon' : key.slice(-8)}#${call}`)
    const isTeammate = teammateId !== undefined && key === String(teammateId)
    if (isTeammate && call === 1) {
      // Deterministic ordering: the teammate's first model call waits for the
      // Lead's turn to end, so the teammate's natural completion notice can
      // never race the spawn tool result inside the Lead's turn. The pending
      // Lead message keeps the teammate's turn open afterwards, leaving the
      // held second call as the only close path.
      return (async function* () {
        await waitUntil(() => state.leadIdle)
        yield* next()
      })()
    }
    if (!isTeammate || call !== 2) return next()
    state.held = true
    state.heldCall = call
    publish()
    writeFileSync(join(gateRoot, 'held.json'), `${JSON.stringify({ teammateSessionId: key, call })}\n`)
    const signal = options.signal ?? new AbortController().signal
    if (!queued && lead !== undefined) {
      // The pending-inbox fact: queue one real team message behind the held
      // step. The plugin times it, so the queued item can never merge into
      // that step.
      queued = true
      void ctx.agentTeams.sendMessage(lead, {
        target: 'worker',
        content: [{ type: 'text', text: 'Hold this thought until asked again.' }],
        signal: new AbortController().signal,
      }).then(() => {
        state.pendingQueued = true
        publish()
      }, () => {
        state.pendingQueued = true
        publish()
      })
    }
    return (async function* () {
      // The model-side replacement for the held call: wait for the request's
      // own abort signal (the llm-replay `hang` contract, no chunks).
      await new Promise((_resolve, reject) => {
        if (signal.aborted) {
          state.cancelled = true
          publish()
          reject(new Error('aborted'))
          return
        }
        signal.addEventListener('abort', () => {
          state.cancelled = true
          publish()
          reject(new Error('aborted'))
        }, { once: true })
      })
    })()
  })

  const fire = () => {
    if (state.triggered || lead === undefined || teammateId === undefined) return
    state.triggered = true
    state.trigger = `subagents.drainContinuableChildren(lead, [${String(teammateId)}])`
    publish()
    void ctx.subagents.drainContinuableChildren(lead, [teammateId]).then(() => {
      state.closed = true
      publish()
    }, (error) => {
      state.closed = true
      state.closeError = String(error)
      publish()
    })
  }
  const evaluate = () => {
    if (state.held && state.pendingInbox >= 1 && state.leadIdle && !state.ready) {
      state.ready = true
      publish()
    }
    if (state.ready && !manual && !state.triggered) fire()
  }

  ctx.on('session/event', (session, event) => {
    state.sessionEvents += 1
    if (session.header.parentSession === undefined && event.type === 'turn/end') {
      state.leadIdle = true
      publish()
      evaluate()
    }
  })
  ctx.on('agent/pre-step', async (payload, next) => {
    state.preSteps += 1
    const agent = payload?.agent
    if (agent === undefined || agent.session === undefined) return next()
    if (agent.session.header.parentSession === undefined) {
      if (lead === undefined) lead = agent
    }
    // No first-step fence here: spawn_teammate blocks until the child's
    // prompt is durably checkpointed, and the teammate's turn admission
    // claims the spawn prompt inside that call, so the Lead's later message
    // can only land behind the first step — the deterministic second step.
    return next()
  })
  ctx.on('agent/inbox/inserted', (payload) => {
    state.inboxInserted += 1
    const agent = payload?.agent
    if (agent === undefined || agent.session === undefined) return
    if (agent.session.header.parentSession === undefined) return
    if (teammateId === undefined) teammateId = agent.session.header.id
    if (state.held) {
      state.pendingInbox += 1
      publish()
      evaluate()
    }
  })

  const manualTimer = manual
    ? setInterval(() => {
      if (state.ready && !state.triggered && existsSync(join(gateRoot, 'trigger'))) fire()
    }, 20)
    : undefined
  manualTimer?.unref()

  ctx.effect(() => () => {
    if (manualTimer !== undefined) clearInterval(manualTimer)
  }, 'agent-team-teardown-trigger ordering')
}

/** Poll until the predicate holds; bounded so a broken scenario fails loud. */
async function waitUntil(predicate) {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('agent-team-teardown-trigger: fence deadline exceeded')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
