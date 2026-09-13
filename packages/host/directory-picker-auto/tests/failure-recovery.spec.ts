import assert from 'node:assert/strict'
import { Context, FiberState } from '@deepseek-ai/cordis'
import { it } from 'vitest'

const dependency = 'failureRecoveryDependency'
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

function fixture() {
  const ctx = new Context()
  let available = true
  ctx.provide(dependency, {}, () => available)
  return {
    ctx,
    notify: () => ctx.reflect.notify([dependency]),
    setAvailable: (value: boolean) => {
      available = value
      ctx.reflect.notify([dependency])
    },
  }
}

/**
 * The Vitest invariant host returns from `ctx.inject` a wrapper whose thenable
 * settles exactly once, after the readiness barrier, with the first activation
 * outcome. An inherited `await()` on that wrapper replays the first failure
 * forever, while the raw Fiber's `await()` resolves immediately while the
 * fiber is still waiting for the barrier. Return both handles: tests assert
 * the first activation through the registration's settlement and observe
 * every later lifecycle state (recovery included) on the raw Fiber.
 */
function register(ctx: Context, callback: (ctx: Context) => void | Promise<void>) {
  const registered = ctx.inject([dependency], callback)
  return { fiber: registered.ctx.fiber, firstActivation: Promise.resolve(registered) }
}

it('keeps failed startup latched when the same service is announced again', async () => {
  const f = fixture()
  const failure = new Error('synthetic startup failure')
  let starts = 0
  let cleanups = 0
  const { fiber, firstActivation } = register(f.ctx, async (ctx) => {
    starts++
    ctx.effect(() => () => { cleanups++ })
    throw failure
  })
  try {
    await assert.rejects(firstActivation, error => error === failure)
    f.notify()
    await assert.rejects(fiber.await(), error => error === failure)
    assert.equal(starts, 1)
    assert.equal(cleanups, 1)
    assert.equal(fiber.state, FiberState.FAILED)
  } finally { await f.ctx.fiber.dispose() }
})

it('does not schedule another startup from a notification during rollback', async () => {
  const f = fixture()
  const entered = deferred()
  const release = deferred()
  const failure = new Error('synthetic rollback failure')
  let starts = 0
  const { fiber, firstActivation } = register(f.ctx, async (ctx) => {
    starts++
    ctx.effect(() => async () => { entered.resolve(); await release.promise })
    throw failure
  })
  try {
    await entered.promise
    assert.equal(fiber.state, FiberState.UNLOADING)
    f.notify()
    release.resolve()
    await assert.rejects(firstActivation, error => error === failure)
    assert.equal(starts, 1)
  } finally {
    release.resolve()
    await f.ctx.fiber.dispose()
  }
})

it('retries after the required service really becomes unavailable and returns', async () => {
  const f = fixture()
  const failure = new Error('synthetic first attempt')
  let starts = 0
  const { fiber, firstActivation } = register(f.ctx, async () => {
    if (++starts === 1) throw failure
  })
  try {
    await assert.rejects(firstActivation, error => error === failure)
    f.setAvailable(false)
    f.setAvailable(true)
    await fiber.await()
    assert.equal(starts, 2)
    assert.equal(fiber.state, FiberState.ACTIVE)
  } finally { await f.ctx.fiber.dispose() }
})

it('retries a failed consumer when its service provider is replaced', async () => {
  const ctx = new Context()
  const provider = await ctx.plugin({
    apply(ctx: Context) { ctx.provide(dependency, {}) },
  })
  const failure = new Error('synthetic old-provider failure')
  let starts = 0
  const { fiber, firstActivation } = register(ctx, async () => {
    if (++starts === 1) throw failure
  })
  try {
    await assert.rejects(firstActivation, error => error === failure)
    await provider.dispose()
    await ctx.plugin({ apply(ctx: Context) { ctx.provide(dependency, {}) } })
    await fiber.await()
    assert.equal(starts, 2)
  } finally { await ctx.fiber.dispose() }
})

it('permits an explicit update to retry with unchanged services', async () => {
  const f = fixture()
  const failure = new Error('synthetic update retry')
  let starts = 0
  const { fiber, firstActivation } = register(f.ctx, async () => {
    if (++starts === 1) throw failure
  })
  try {
    await assert.rejects(firstActivation, error => error === failure)
    await fiber.update({ retry: true })
    await fiber.await()
    assert.equal(starts, 2)
  } finally { await f.ctx.fiber.dispose() }
})

it('does not revive a disposed failed consumer when services recover', async () => {
  const f = fixture()
  const failure = new Error('synthetic disposed failure')
  let starts = 0
  const { fiber, firstActivation } = register(f.ctx, async () => { starts++; throw failure })
  try {
    await assert.rejects(firstActivation, error => error === failure)
    await fiber.dispose()
    f.setAvailable(false)
    f.setAvailable(true)
    assert.equal(starts, 1)
    assert.equal(fiber.uid, null)
    assert.equal(fiber.state, FiberState.DISPOSED)
    assert.equal(fiber.inertia, undefined)
  } finally { await f.ctx.fiber.dispose() }
})

it('recognizes a service loss that occurred while startup was awaiting', async () => {
  const f = fixture()
  const entered = deferred()
  const release = deferred()
  const failure = new Error('synthetic interrupted startup')
  let starts = 0
  const { fiber, firstActivation } = register(f.ctx, async () => {
    if (++starts !== 1) return
    entered.resolve()
    await release.promise
    throw failure
  })
  try {
    await entered.promise
    f.setAvailable(false)
    release.resolve()
    await assert.rejects(firstActivation, error => error === failure)
    f.setAvailable(true)
    await fiber.await()
    assert.equal(starts, 2)
  } finally {
    release.resolve()
    await f.ctx.fiber.dispose()
  }
})

it('latches a failed retry instead of repeating it on the next notification', async () => {
  const f = fixture()
  const failure = new Error('synthetic repeated failure')
  let starts = 0
  const { fiber, firstActivation } = register(f.ctx, async () => { starts++; throw failure })
  try {
    await assert.rejects(firstActivation, error => error === failure)
    f.setAvailable(false)
    f.setAvailable(true)
    await assert.rejects(fiber.await(), error => error === failure)
    f.notify()
    await assert.rejects(fiber.await(), error => error === failure)
    assert.equal(starts, 2)
  } finally { await f.ctx.fiber.dispose() }
})
