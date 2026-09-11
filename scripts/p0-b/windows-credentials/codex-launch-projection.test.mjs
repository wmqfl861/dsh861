import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { publicConfigDigest } from '../model-config.mjs'
import { projectCodexLaunch } from './codex-launch-projection.mjs'

const configuration = JSON.parse(readFileSync(new URL('../../../config/agents/models.v1.json', import.meta.url), 'utf8'))
const lock = JSON.parse(readFileSync(new URL('../../../config/agents/models.v1.lock.json', import.meta.url), 'utf8'))
function fixture() {
  const config = structuredClone(configuration)
  // Only this synthetic fixture is re-locked; approved files are never written.
  config.agents.codex.baseUrl = 'https://approved.example.invalid/v1'
  return { config, approved: { ...lock, publicConfigSha256: publicConfigDigest(config) },
    input: { platform: 'win32', workspace: 'C:\\Albert\\project\\dsh861',
      runRoot: 'C:\\Albert\\private-runs\\one', executable: 'C:\\Tools\\Codex\\codex.exe',
      executableSha256: 'a'.repeat(64), systemRoot: 'C:\\Windows', toolDirectories: ['C:\\Windows\\System32'] } }
}

test('approved HTTP config cannot be projected for a real launch', () => {
  const { input } = fixture()
  assert.throws(() => projectCodexLaunch(configuration, lock, input), /CODEX_LAUNCH_PROJECTION_REFUSED/)
})

test('projects exact routes and read-only native argv without authorizing or reading', () => {
  const { config, approved, input } = fixture()
  const result = projectCodexLaunch(config, approved, input)
  assert.equal(result.status, 'CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED')
  assert.equal(result.productAccepted, false)
  assert.equal(result.args[result.args.indexOf('--model') + 1], 'gpt-6-astra')
  assert.ok(result.args.includes('model_reasoning_effort="max"'))
  assert.equal(result.args[result.args.indexOf('--sandbox') + 1], 'read-only')
  assert.equal(result.args.at(-1), '-')
  assert.match(result.configToml, /\[model_providers\."my-gpt"\]/)
  assert.match(result.configToml, /wire_api = "responses"/)
  assert.match(result.configToml, /inherit = "none"/)
  assert.equal(Object.hasOwn(result.environment, result.credentialEnvironmentVariable), false)
  assert.equal(result.environment.CODEX_HOME, 'C:\\Albert\\private-runs\\one\\codex-home')
  assert.equal(result.environment.USERPROFILE, 'C:\\Albert\\private-runs\\one\\home')
  config.agents.codex.model = 'changed'
  input.toolDirectories.push('C:\\Unexpected')
  assert.equal(result.route.model, 'gpt-6-astra')
  assert.equal(result.environment.PATH, 'C:\\Windows\\System32')
  assert.ok(Object.isFrozen(result.args) && Object.isFrozen(result.environment))
})

const invalid = [
  f => { f.config.agents.codex.model = 'not-approved' },
  f => { f.input.extra = 'ignored-field' },
  f => { f.input.runRoot = 'C:\\Albert\\project\\dsh861\\private' },
  f => { f.input.runRoot = 'C:\\Albert' },
  f => { f.input.runRoot = 'c:\\albert\\project\\DSH861\\private' },
  f => { f.input.workspace = 'relative' },
  f => { f.input.runRoot = '\\\\server\\share' },
  f => { f.input.executable = 'C:\\Albert\\private-runs\\one\\codex.exe' },
  f => { f.input.executableSha256 = 'not-a-hash' },
  f => { f.input.toolDirectories = [] },
  f => { f.input.toolDirectories = ['C:\\Safe;C:\\Injected'] },
  f => { f.input.systemRoot = 'C:\\Windows\nunsafe' },
]
for (const [index, change] of invalid.entries()) {
  test(`refuses declaration/path boundary ${index + 1}`, () => {
    const f = fixture(); change(f)
    assert.throws(() => projectCodexLaunch(f.config, f.approved, f.input),
      error => error.message === 'CODEX_LAUNCH_PROJECTION_REFUSED')
  })
}

test('POSIX projection uses explicit isolated paths and keeps shell key forwarding disabled', () => {
  const { config, approved, input } = fixture()
  Object.assign(input, { platform: 'linux', workspace: '/work/repo', runRoot: '/work/private/one',
    executable: '/tools/codex', systemRoot: null, toolDirectories: ['/usr/bin', '/bin'] })
  const result = projectCodexLaunch(config, approved, input)
  assert.equal(result.environment.CODEX_HOME, '/work/private/one/codex-home')
  assert.equal(result.environment.PATH, '/usr/bin:/bin')
  const shellConfig = result.configToml.split('[shell_environment_policy]')[1]
  assert.equal(shellConfig.includes(result.credentialEnvironmentVariable), false)
  assert.equal(result.requiredBeforeCredentialRead.includes('external-budget-enforcement'), true)
})
