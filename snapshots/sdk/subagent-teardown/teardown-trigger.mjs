import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'subagent-teardown-trigger'
export const inject = ['llm', 'agents', 'subagents']

/**
 * Scenario-local gate and trigger for the subagent-teardown snapshot.
 *
 * The parent's authored transcript spawns one continuable child and sends one
 * follow-up; the child consumes that follow-up into a held model call, and a
 * scenario-authored steer stays PENDING in the child's inbox while the call
 * is held. This plugin makes that ordering deterministic and then closes the
 * child through the real production service entry:
 *
 *  - the child's first step waits until both the delegation and the follow-up
 *    are accepted, so the child consumes the follow-up into a second step of
 *    the same turn on every runner.
 *  - the child's SECOND model call is replaced by a hang that waits for the
 *    request's own abort signal (the same contract as an llm-replay `hang`
 *    entry; no chunks are forwarded, so the cancelled turn persists no
 *    assistant message). `.dsh/teardown-gate/held.json` marks the hold.
 *  - once the hold is open, the plugin queues one real steer prompt to the
 *    child (`subagents.prompt`, delivery `steer`) — the pending-inbox fact —
 *    which the held step can never consume.
 *  - once (held call + pending inbox + idle parent) all hold, the plugin
 *    calls `subagents.drainContinuableChildren(parent, [childId])` — the
 *    real close — either immediately (auto mode) or after the test process
 *    creates `.dsh/teardown-gate/trigger` (manual mode).
 *  - `.dsh/teardown-gate/state.json` records the observed facts (hold,
 *    pending inbox, parent idle, trigger identity, cancel handshake, close
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
    steerQueued: false,
    pendingInbox: 0,
    parentIdle: false,
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

  let parent
  let childId
  let childInserts = 0
  let childFirstStepFenced = false
  let steered = false

  const callsBySession = new Map()
  ctx.on('llm/stream', (options, next) => {
    const key = options.sessionId === undefined ? '\0anon\0' : String(options.sessionId)
    const call = (callsBySession.get(key) ?? 0) + 1
    callsBySession.set(key, call)
    state.llmCalls.push(`${key === '\0anon\0' ? 'anon' : key.slice(-8)}#${call}`)
    const isChild = childId !== undefined && key === String(childId)
    if (!isChild || call !== 2) return next()
    state.held = true
    state.heldCall = call
    publish()
    writeFileSync(join(gateRoot, 'held.json'), `${JSON.stringify({ childSessionId: key, call })}
`)
    const signal = options.signal ?? new AbortController().signal
    if (!steered && parent !== undefined) {
      // The pending-inbox fact: queue a real steer behind the held step. The
      // plugin times it, so the queued item can never merge into that step.
      steered = true
      void ctx.subagents.prompt({
        requestId: 'subagent-teardown-steer',
        parentSessionId: parent.session.id,
        childSessionId: childId,
        mode: 'continuable',
        delivery: 'steer',
        content: [{ type: 'text', text: 'Hold this thought until asked again.' }],
      }, new AbortController().signal).then(() => {
        state.steerQueued = true
        publish()
      }, () => {
        state.steerQueued = true
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
    if (state.triggered || parent === undefined || childId === undefined) return
    state.triggered = true
    state.trigger = `subagents.drainContinuableChildren(parent, [${String(childId)}])`
    publish()
    void ctx.subagents.drainContinuableChildren(parent, [childId]).then(() => {
      state.closed = true
      publish()
    }, (error) => {
      state.closed = true
      state.closeError = String(error)
      publish()
    })
  }
  const evaluate = () => {
    if (state.held && state.pendingInbox >= 1 && state.parentIdle && !state.ready) {
      state.ready = true
      publish()
    }
    if (state.ready && !manual && !state.triggered) fire()
  }

  ctx.on('session/event', (session, event) => {
    state.sessionEvents += 1
    if (session.header.parentSession === undefined && event.type === 'turn/end') {
      state.parentIdle = true
      publish()
      evaluate()
    }
  })
  ctx.on('agent/pre-step', async (payload, next) => {
    state.preSteps += 1
    const agent = payload?.agent
    if (agent === undefined || agent.session === undefined) return next()
    if (agent.session.header.parentSession === undefined) {
      if (parent === undefined) parent = agent
      return next()
    }
    if (!childFirstStepFenced) {
      // Deterministic step shape: the child's first step starts only after
      // the delegation and the follow-up are both accepted, so the follow-up
      // is always consumed by a second step of the same turn.
      childFirstStepFenced = true
      await waitUntil(() => childInserts >= 2)
    }
    return next()
  })
  ctx.on('agent/inbox/inserted', (payload) => {
    state.inboxInserted += 1
    const agent = payload?.agent
    if (agent === undefined || agent.session === undefined) return
    if (agent.session.header.parentSession === undefined) return
    if (childId === undefined) childId = agent.session.header.id
    childInserts += 1
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
  }, 'subagent-teardown-trigger ordering')
}

/** Poll until the predicate holds; bounded so a broken scenario fails loud. */
async function waitUntil(predicate) {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('subagent-teardown-trigger: fence deadline exceeded')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
