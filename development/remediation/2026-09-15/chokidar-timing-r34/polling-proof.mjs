/** Source-derived polling mechanism only; NOT real Chokidar, VFS, Loader or Vitest. */
import assert from 'node:assert/strict'
import { test } from 'node:test'

// Models the size/stable-time decision read from paulmillr/chokidar@5.0.0
// src/index.ts (_awaitWriteFinish). stat delivery and write-event admission
// below are explicit fixtures, not the library's actual fs event delivery.
function fixture() {
  let content = ''
  let pending
  const events = []
  function poll(previousSize) {
    if (!pending) return
    if (previousSize !== undefined && previousSize !== content.length) pending.lastChange = Date.now()
    if (Date.now() - pending.lastChange >= 30) {
      const event = pending.event
      pending = undefined
      events.push({ event, content, at: Date.now() })
    } else {
      setTimeout(poll, 5, content.length)
    }
  }
  return {
    events,
    append(part) {
      const existed = content.length !== 0
      content += part
      if (pending) pending.lastChange = Date.now()
      else {
        pending = { event: existed ? 'change' : 'add', lastChange: Date.now() }
        setTimeout(poll, 5)
      }
    },
  }
}

test('writes within the stability interval publish complete content once', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const f = fixture()
  const tick = n => { for (let i = 0; i < n; i++) t.mock.timers.tick(1) }
  f.append('a'); tick(10); assert.deepEqual(f.events, [])
  f.append('b'); tick(10); assert.deepEqual(f.events, [])
  f.append('c'); tick(29); assert.deepEqual(f.events, [])
  tick(11)
  assert.deepEqual(f.events.map(e => [e.event, e.content]), [['add', 'abc']])
  tick(60)
  assert.equal(f.events.length, 1)
})

test('a schedule with a completed stable interval permits a later change', t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 })
  const f = fixture()
  const tick = n => { for (let i = 0; i < n; i++) t.mock.timers.tick(1) }
  f.append('a'); tick(40)
  assert.deepEqual(f.events.map(e => e.event), ['add'])
  f.append('b'); tick(29)
  assert.deepEqual(f.events.map(e => e.event), ['add'])
  tick(11)
  assert.deepEqual(f.events.map(e => [e.event, e.content]), [['add', 'a'], ['change', 'ab']])
  tick(60)
  assert.equal(f.events.length, 2)
})
