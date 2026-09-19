/** Isolated r27 identity probe, not a Context/Vitest integration test. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const mode = process.argv[2]
assert.ok(mode === 'legacy' || mode === 'symbol', 'usage: node scope-probe.mjs legacy|symbol [reflect.ts]')
const fixtureContextTag = Symbol('fixture-context-tag')
const key = mode === 'legacy' ? 'fixtureId' : fixtureContextTag
const symbols = {
  shadow: Symbol.for('cordis.shadow'),
  receiver: Symbol.for('cordis.receiver'),
  isolate: Symbol.for('cordis.isolate'),
}

// Exact get-trap excerpt from reflect.ts, blob 141a2d2f7a421d0020f61704c7e74032a1f3ec49.
// Only its three TypeScript annotations are removed before evaluation below.
const source = String.raw`    get: (target, prop, ctx: Context) => {
      if (isSpecialProperty(prop)) {
        return Reflect.get(target, prop, ctx)
      }
      if (Reflect.has(target, prop)) {
        return getTraceable(ctx, Reflect.get(target, prop, ctx))
      }

      const error = new Error(\`cannot get property "\${prop}" without inject\`)

      try {
        const def = target.reflect.props[prop]
        if (def?.type === 'accessor') {
          return def.get.call(ctx, ctx[symbols.receiver], error)
        }

        // a fiber-less def site cannot declare \`inject\` at all, so it keeps the unchecked root access.
        const defSite = (ctx[symbols.shadow] as Context | undefined) ?? ctx
        if (!defSite.fiber.runtime) return ctx.reflect.get(prop, false)
        return ctx.events.waterfall('internal/get', ctx, prop, error, () => {
          const key = target[symbols.isolate][prop]
          let fiber = defSite.fiber
          while (true) {
            const impl = fiber.store?.[prop]
            if (impl) return getTraceable(ctx, impl.value)
            if (prop in fiber.inject) {
              error.message = \`cannot get required service "\${prop}" in inactive context\`
              throw error
            }
            if (!fiber.runtime) throw error
            if (fiber.parent[symbols.isolate][prop] !== key) throw error
            fiber = fiber.parent.fiber
          }
        })
      } catch (e: any) {
        throw e === error ? enhanceError(e) : e
      }
    },`.replaceAll('\\`', '`').replaceAll('\\${', '${')

if (process.argv[3]) {
  const fullSource = readFileSync(process.argv[3], 'utf8')
  assert.ok(fullSource.includes(source), 'pinned get-trap excerpt does not match supplied reflect.ts')
}
const jsSource = source.replace(': Context)', ')')
  .replace(' as Context | undefined', '')
  .replace('(e: any)', '(e)')

// These are explicit fixture collaborators: no real Fiber, Context, registry,
// tracing, event dispatch, or stack-splicing implementation is loaded here.
const getTraceable = (_ctx, value) => value
const enhanceError = error => error
const RESERVED_WORDS = ['prototype', 'then']
function isSpecialProperty(prop) {
  return typeof prop === 'symbol'
    || RESERVED_WORDS.includes(prop)
    || parseInt(prop).toString() === prop
    || prop.startsWith('_')
}
const handler = new Function('getTraceable', 'symbols', 'enhanceError', 'isSpecialProperty',
  `return ({${jsSource}})`)(getTraceable, symbols, enhanceError, isSpecialProperty)

function rootContext() {
  const target = {
    [symbols.isolate]: Object.create(null),
    reflect: { props: Object.create(null), get: () => undefined },
    events: { waterfall: (_name, _ctx, _prop, _error, next) => next() },
    fiber: { runtime: null, inject: Object.create(null), store: Object.create(null) },
  }
  return new Proxy(target, handler)
}
function extend(ctx, metadata = {}) {
  return Object.defineProperties(Object.create(ctx), Object.getOwnPropertyDescriptors(metadata))
}
function serviceShadow(ctx, root) {
  return extend(ctx, { [symbols.shadow]: {
    fiber: { runtime: {}, inject: Object.create(null), store: Object.create(null), parent: root },
  } })
}
function identity(candidate) { return candidate[key] }

test('marked caller retains its identity through a service shadow', () => {
  const root = rootContext()
  assert.equal(identity(serviceShadow(extend(root, { [key]: 'agent-2' }), root)), 'agent-2')
})
test('child caller inherits the marked identity', () => {
  const root = rootContext()
  assert.equal(identity(serviceShadow(extend(extend(root, { [key]: 'agent-2' })), root)), 'agent-2')
})
test('own metadata overrides the inherited identity', () => {
  const root = rootContext()
  const parent = extend(root, { [key]: 'agent-2' })
  assert.equal(identity(serviceShadow(extend(parent, { [key]: 'agent-3' }), root)), 'agent-3')
})
test('unmarked service-shadow caller returns no fixture identity', () => {
  const root = rootContext()
  assert.equal(identity(serviceShadow(root, root)), undefined)
})
test('unmarked sibling does not inherit another scope identity', () => {
  const root = rootContext()
  const marked = extend(root, { [key]: 'agent-2' })
  assert.equal(identity(marked), 'agent-2')
  assert.equal(identity(serviceShadow(extend(root), root)), undefined)
})
test('unshadowed unmarked root has no identity', () => {
  assert.equal(identity(rootContext()), undefined)
})
test('identity lookup does not default an empty identity', () => {
  const root = rootContext()
  assert.equal(identity(serviceShadow(extend(root, { [key]: '' }), root)), '')
})
test('unrelated undeclared service reads remain rejected', () => {
  const root = rootContext()
  assert.throws(() => serviceShadow(root, root).undeclaredService,
    /cannot get property "undeclaredService" without inject/)
})
