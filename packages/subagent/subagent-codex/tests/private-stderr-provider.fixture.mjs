/** Isolated provider-wiring fixture; mock schema/registry/run services, real Node child. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require(process.env.DSH_TEST_TYPESCRIPT_PATH || 'typescript')
const sourcePath = process.env.DSH_TEST_CODEX_INDEX
  || fileURLToPath(new URL('../src/index.ts', import.meta.url))
const source = readFileSync(sourcePath, 'utf8')
const helper = readFileSync(new URL('../src/private-stderr.ts', import.meta.url), 'utf8')
const expectPrivate = process.env.DSH_TEST_EXPECT_RAW !== '1'
const context = vm.createContext({ AbortController })
const compile = (text, name) => {
  const result = ts.transpileModule(text, { fileName: name, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } })
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  return new vm.SourceTextModule(result.outputText, { context, identifier: name })
}
const exportsModule = exports => new vm.SyntheticModule(Object.keys(exports), function () {
  for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
}, { context })
const chain = () => ({ min() { return this }, default() { return this } })
const modules = new Map([
  ['@deepseek-ai/schemastery', exportsModule({ default: {
    object: value => value, string: chain, number: chain, dict: chain, union: chain,
  } })],
  ['@deepseek-ai/dsh-timeout', exportsModule({ MAX_TIMER_DELAY_MS: 2147483647 })],
  ['@deepseek-ai/dsh-subagent', exportsModule({
    assertPositiveFinite: (_owner, _field, value) => assert.ok(Number.isFinite(value) && value > 0),
    NO_START_CAPABILITIES: Object.freeze({}),
    resolveChildCwd: (_owner, _child, parent) => parent,
  })],
  ['./run.ts', exportsModule({
    CODEX_PERMISSION_MODES: ['never', 'approve-for-me', 'dangerously-bypass-approvals-and-sandbox'],
    DEFAULT_CODEX_PERMISSION_MODE: 'never', DEFAULT_DISPOSE_GRACE_MS: 3000,
    codexStartupFailure: () => new Error('fixture startup failure'),
    // Capture the real Provider's fully resolved spec; this is not Codex protocol execution.
    startCodexRun: (_request, spec) => spec,
  })],
  ['./private-stderr.ts', compile(helper, 'private-stderr.ts')],
])
const entry = compile(source, 'index.ts')
await entry.link(specifier => {
  const module = modules.get(specifier)
  if (!module) throw new Error('Unexpected fixture dependency')
  return module
})
await entry.evaluate()

const results = []
for (const exitCode of [0, 7]) {
  let registered
  let spawned
  let emittedSpec
  const ctx = {
    subagents: { registerProvider(provider) { registered = provider } },
    logger: { warn() {} },
    subprocess: {
      spawn(spec) {
        emittedSpec = spec
        const [program, ...args] = spec.argv
        spawned = spawn(program, args, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000,
          cwd: spec.cwd, env: { ...process.env, ...spec.env }, windowsHide: true })
        const done = new Promise((resolve, reject) => {
          spawned.once('error', reject)
          spawned.once('close', (code, signal) => resolve({ exitCode: code, signal }))
        })
        return {
          pid: spawned.pid ?? -1, stdin: spawned.stdin, stdout: spawned.stdout, stderr: spawned.stderr,
          collected: {}, done, terminate() { spawned.kill() }, async waitForExit() { await done; return true },
        }
      },
    },
  }
  const env = { DSH_FIXTURE_MARKER: 'synthetic-only' }
  entry.namespace.apply(ctx, { providerName: 'codex-fixture', model: 'owner-fixed-model',
    env, permissionMode: 'never', disposeGraceMs: 3000 })
  const resolved = registered.start({ parent: { session: { header: { cwd: process.cwd() } } },
    signal: new AbortController().signal, prompt: [{ type: 'text', text: 'fixture' }] })
  assert.equal(resolved.model, 'owner-fixed-model')
  assert.equal(resolved.env, env)
  assert.equal(resolved.permissionMode, 'never')
  const command = { argv: [process.execPath, '-e',
    `process.stderr.write('SYNTHETIC_PRIVATE_DIAGNOSTIC'.repeat(20000), () => { process.stdout.write('SAFE_ANSWER', () => { process.exitCode = ${exitCode} }) })`],
    cwd: process.cwd(), stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' }, graceMs: 3000, env }
  const handle = resolved.spawn(command)
  let rawBytesAtRunner = 0
  let stdout = ''
  handle.stderr?.on('data', chunk => { rawBytesAtRunner += chunk.length })
  handle.stdout.on('data', chunk => { stdout += chunk.toString() })
  try {
    const outcome = await handle.done
    assert.equal(outcome.exitCode, exitCode)
    assert.equal(stdout, 'SAFE_ANSWER')
    assert.equal(emittedSpec, command)
    assert.equal(handle.stderr === undefined, expectPrivate)
    assert.equal(rawBytesAtRunner === 0, expectPrivate)
    results.push({ exitCode, rawBytesAtRunner, stdoutPreserved: true, spawnSpecPreserved: true,
      stderrPrivate: handle.stderr === undefined })
  } finally {
    if (spawned.exitCode === null && spawned.signalCode === null) spawned.kill()
    await handle.done.catch(() => {})
  }
}
console.log(JSON.stringify({ kind: 'isolated-provider-wiring-fixture', expectPrivate,
  sourceSha256: createHash('sha256').update(source).digest('hex'), results,
  actualCodexInvoked: false, loaderCompositionVerified: false, productAccepted: false }, null, 2))
