import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { it } from 'vitest'
import { standardDecoratorPlugin, vitestExecArgv } from '../vitest.shared.ts'

const methodSource = `
function doubled(method: () => number) {
  return function () { return method.call(this) * 2 }
}
class Answer {
  @doubled
  value(): number { return 21 }
}
new Answer().value()
`

it('executes decorated TypeScript through the classic compiler API', () => {
  const result = standardDecoratorPlugin().transform(methodSource, '/fixture/answer.ts')
  assert.ok(result)
  assert.equal(runInNewContext(result.code, {}), 42)
  assert.ok(result.map)
  const map = JSON.parse(result.map)
  assert.ok(map.sources.some((source: string) => source.endsWith('answer.ts')))
  assert.doesNotMatch(result.code, /sourceMappingURL=/)
})

it('leaves undecorated TypeScript and non-TypeScript files to Vite', () => {
  const plugin = standardDecoratorPlugin()
  assert.equal(plugin.transform('const answer: number = 42', '/fixture/answer.ts'), undefined)
  assert.equal(plugin.transform(methodSource, '/fixture/answer.js'), undefined)
})

it('transforms query-suffixed TSX with the automatic JSX runtime', () => {
  const source = `
function identity(value: unknown) { return value }
@identity
class Example { render() { return <span>hello</span> } }
`
  const result = standardDecoratorPlugin().transform(source, '/fixture/example.tsx?cache=1')
  assert.ok(result)
  assert.match(result.code, /react\/jsx-runtime/)
  assert.doesNotMatch(result.code, /<span>/)
})

it('supports decorated cts and mts inputs without retaining query text', () => {
  for (const extension of ['cts', 'mts']) {
    const result = standardDecoratorPlugin().transform(methodSource, `/fixture/answer.${extension}?v=1`)
    assert.ok(result?.map)
    const map = JSON.parse(result.map)
    assert.ok(map.sources.some((source: string) => source.endsWith(`answer.${extension}`)))
  }
})

it('keeps the pre-transform phase and the host Web Storage worker setting', () => {
  assert.equal(standardDecoratorPlugin().enforce, 'pre')
  assert.deepEqual(vitestExecArgv, process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [])
})
