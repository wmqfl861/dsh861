/** Loader list/store/journal transactions with controlled plugin lifecycle callbacks. */
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import { EntryGroup, EntryTree, type Entry, type EntryChange, type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { it } from 'vitest'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture() {
  const changes: EntryChange[] = []
  const notifications: unknown[][] = []
  // Only the lifecycle context is synthetic. Every tree/group operation under
  // test is the vendored implementation; no real plugin is started here.
  const ctx = { fiber: { uid: 1 }, emit: (...args: unknown[]) => { notifications.push(args) } } as unknown as Context
  const tree = Object.create(EntryTree.prototype) as EntryTree
  tree.ctx = ctx
  tree.store = Object.create(null) as EntryTree['store']
  tree.root = new EntryGroup(ctx, tree)
  tree.commit = (change) => { changes.push(change) }
  return { tree, group: tree.root, changes, notifications }
}

function install(group: EntryGroup, options: EntryOptions, dispose: () => Promise<void>) {
  const entry = { options, parent: group, _dispose: dispose } as unknown as Entry
  group.tree.store[options.id] = entry
  return entry
}

it('publishes a successful create only after activation settles', async () => {
  const f = fixture(), gate = deferred()
  const options: EntryOptions = { id: 'candidate', name: 'candidate' }
  f.group.create = async () => { await gate.promise; return options.id }
  const pending = f.tree.create(options)
  const before = f.changes.slice()
  gate.resolve()
  assert.equal(await pending, options.id)
  assert.deepEqual(before, [])
  assert.equal(f.group.data[0], options)
  assert.deepEqual(f.changes, [{ id: options.id, group: f.group, options }])
})

it('rejects a failed create without leaving a row or publishing it', async () => {
  const f = fixture(), failure = new Error('surface import failed')
  const candidate: EntryOptions = { id: 'surface', name: 'surface' }
  f.group.create = async () => { throw failure }
  await assert.rejects(f.tree.create(candidate), error => error === failure)
  assert.deepEqual(f.group.data, [])
  assert.deepEqual(f.changes, [])
})

it('rolls back only the failed candidate and keeps concurrent sibling creation', async () => {
  const f = fixture(), gate = deferred(), failure = new Error('candidate failed')
  const old: EntryOptions = { id: 'old', name: 'old' }
  const candidate: EntryOptions = { id: 'candidate', name: 'candidate' }
  const sibling: EntryOptions = { id: 'sibling', name: 'sibling' }
  f.group.data = [old]
  f.group.create = async (options) => {
    if (options === candidate) await gate.promise
    return (options as EntryOptions).id
  }
  const pending = f.tree.create(candidate, null, 0)
  const rejected = assert.rejects(pending, error => error === failure)
  await f.tree.create(sibling)
  gate.reject(failure)
  await rejected
  assert.deepEqual(f.group.data, [old, sibling])
  assert.deepEqual(f.changes.map(change => change.id), ['sibling'])
})

it('commits through the actual nested owner and preserves insertion identity', async () => {
  const root = fixture(), nested = fixture()
  const first: EntryOptions = { id: 'first', name: 'first' }
  const last: EntryOptions = { id: 'last', name: 'last' }
  const middle: EntryOptions = { id: 'middle', name: 'middle' }
  nested.group.data = [first, last]
  root.tree.resolveGroup = () => nested.group
  nested.group.create = async () => 'include:middle'
  assert.equal(await root.tree.create(middle, 'include', 1), 'include:middle')
  assert.deepEqual(nested.group.data, [first, middle, last])
  assert.equal(nested.group.data[1], middle)
  assert.deepEqual(root.changes, [])
  assert.deepEqual(nested.changes, [{ id: 'middle', group: nested.group, options: middle }])
})

it('unlinks a permanent removal before invoking asynchronous plugin cleanup', async () => {
  const f = fixture(), gate = deferred()
  const options: EntryOptions = { id: 'backend', name: 'backend' }
  f.group.data = [options]
  let observedStore: Entry | undefined
  let observedRows: EntryOptions[] = []
  const entry = install(f.group, options, async () => {
    observedStore = f.tree.store[options.id]
    observedRows = [...f.group.data]
    await gate.promise
  })
  let finished = false
  const pending = f.group.remove(options.id).then(() => { finished = true })
  await Promise.resolve()
  const before = { finished, notifications: f.notifications.length }
  gate.resolve()
  await pending
  assert.equal(observedStore, undefined)
  assert.deepEqual(observedRows, [])
  assert.deepEqual(before, { finished: false, notifications: 0 })
  assert.deepEqual(f.notifications, [['loader/partial-dispose', entry, options, false]])
})

it('cannot recreate a removed backend from the live list during its teardown', async () => {
  const f = fixture()
  const options: EntryOptions = { id: 'backend', name: 'backend' }
  f.group.data = [options]
  let recreations = 0
  f.group.create = async (row) => {
    recreations++
    const candidate = row as EntryOptions
    install(f.group, candidate, async () => {})
    return candidate.id
  }
  install(f.group, options, async () => {
    // Reconciliation starts while remove() is suspended in the disposer.
    await f.group.update([...f.group.data])
  })
  await f.group.remove(options.id)
  assert.equal(recreations, 0)
  assert.deepEqual(Object.keys(f.tree.store), [])
  assert.deepEqual(f.group.data, [])
})

it('retains configured rows for a stop instead of permanently deleting them', async () => {
  const f = fixture()
  const options: EntryOptions = { id: 'backend', name: 'backend' }
  const data = [options]
  f.group.data = data
  let stopped = 0
  install(f.group, options, async () => { stopped++ })
  await f.group.stop()
  assert.equal(stopped, 1)
  assert.equal(f.group.data, data)
  assert.equal(f.group.data[0], options)
  assert.deepEqual(Object.keys(f.tree.store), [])
})

it('does not remove an entry adopted by another group', async () => {
  const f = fixture()
  const other = new EntryGroup(f.tree.ctx, f.tree)
  const options: EntryOptions = { id: 'moved', name: 'moved' }
  other.data = [options]
  let stopped = 0
  const entry = install(other, options, async () => { stopped++ })
  await f.group.remove(options.id)
  assert.equal(stopped, 0)
  assert.equal(f.tree.store[options.id], entry)
  assert.equal(other.data[0], options)
  assert.deepEqual(f.notifications, [])
})

it('propagates teardown failure without making the removed row eligible for revival', async () => {
  const f = fixture(), failure = new Error('cleanup failed')
  const options: EntryOptions = { id: 'backend', name: 'backend' }
  f.group.data = [options]
  install(f.group, options, async () => { throw failure })
  await assert.rejects(f.group.remove(options.id), error => error === failure)
  assert.deepEqual(Object.keys(f.tree.store), [])
  assert.deepEqual(f.group.data, [])
  assert.deepEqual(f.notifications, [])
})

it('emits tree removal after cleanup has finished and keeps sibling rows', async () => {
  const f = fixture(), gate = deferred()
  const first: EntryOptions = { id: 'first', name: 'first' }
  const last: EntryOptions = { id: 'last', name: 'last' }
  f.group.data = [first, last]
  install(f.group, first, async () => { await gate.promise })
  const pending = f.tree.remove(first.id)
  await Promise.resolve()
  const before = f.changes.slice()
  gate.resolve()
  await pending
  assert.deepEqual(before, [])
  assert.deepEqual(f.group.data, [last])
  assert.deepEqual(f.changes, [{ id: first.id, group: f.group, legacy: first }])
})
