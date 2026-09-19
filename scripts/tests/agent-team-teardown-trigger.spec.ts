/**
 * Deterministic regressions for the agent-team-teardown snapshot trigger's
 * send-confirmation barrier: the close may arm only after the scenario's own
 * `agentTeams.sendMessage` settles with `status: 'accepted'` and a usable
 * message identity, on top of the original held-call / pending-inbox /
 * idle-Lead conditions. The scenarios run in a test-owned subprocess
 * (the driver fixture) so the module's `process.cwd()`-rooted gate directory
 * and `DSH_TEARDOWN_MANUAL` env never leak into the vitest worker.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const driverPath = join(root, 'scripts', 'tests', 'fixtures', 'agent-team-teardown-trigger-driver.mjs')
const triggerPath = join(root, 'snapshots', 'sdk', 'agent-team-teardown', 'teardown-trigger.mjs')

interface DriverCheck {
  readonly name: string
  readonly pass: boolean
  readonly detail: string
}

interface DriverScenario {
  readonly name: string
  readonly ok: boolean
  readonly error: string
  readonly checks: readonly DriverCheck[]
  readonly drainCalls: readonly { agentId?: string; ids: readonly string[] }[]
  readonly sendCalls: readonly { agentId?: string; target?: string }[]
}

interface DriverResult {
  readonly ok: boolean
  readonly module: { readonly path: string; readonly sha256: string; readonly blob: string; readonly name: string }
  readonly scenarios: readonly DriverScenario[]
}

/** One required check name per causal ordering the barrier must pin. */
const REQUIRED_CHECKS: Readonly<Record<string, readonly string[]>> = {
  's1-inbox-before-ack': ['no-close-while-send-pending', 'close-exactly-once-after-acceptance', 'accepted-identity-recorded', 'drain-targets-exact-teammate'],
  's2-ack-before-conditions': ['no-close-on-acceptance-alone', 'no-close-without-lead-idle', 'close-exactly-once-after-conditions', 'accepted-reaches-ready'],
  's3-queued': ['no-close-on-queued', 'queued-reported-as-not-accepted'],
  's4-reject': ['no-close-on-reject', 'reject-reason-preserved'],
  's5-invalid-identity': ['no-close-on-invalid-identity', 'invalid-identity-reported'],
  's6-manual-early-trigger': ['unrelated-child-not-counted', 'teammate-inserts-counted', 'no-close-before-ack-despite-trigger-file', 'manual-close-exactly-once-after-ack', 'drain-targets-exact-teammate', 'duplicate-polls-do-not-double-close'],
  's7-abort-and-close-error': ['close-exactly-once-after-acceptance', 'abort-handshake-preserved', 'close-error-preserved'],
}

describe('agent-team-teardown trigger send-confirmation barrier', () => {
  let workdir: string | undefined
  let exitCode: number | null = null
  let result: DriverResult | undefined

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'r46-trigger-spec-'))
    const resultPath = join(workdir, 'result.json')
    const env: Record<string, string> = {
      ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)) as Record<string, string>,
    }
    delete env.DSH_TEARDOWN_MANUAL
    const child = spawn(process.execPath, [driverPath, resultPath], { cwd: workdir, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { stdout += chunk })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
      const killTimer = setTimeout(() => {
        child.kill()
        rejectExit(new Error(`trigger driver did not exit within 90s (stdout tail: ${stdout.slice(-400)})`))
      }, 90_000).unref()
      child.on('error', (error) => { clearTimeout(killTimer); rejectExit(error) })
      child.on('exit', (code) => { clearTimeout(killTimer); resolveExit(code) })
    })
    let payload = ''
    try {
      payload = await readFile(resultPath, 'utf8')
    } catch (error) {
      throw new Error(`trigger driver wrote no result (exit ${String(exitCode)}, stderr: ${stderr.slice(0, 400)})`, { cause: error })
    }
    result = JSON.parse(payload) as DriverResult
  }, 100_000)

  afterAll(async () => {
    if (workdir !== undefined) await rm(workdir, { recursive: true, force: true })
  })

  it('drove the actual repository trigger module, not a transcribed copy', async () => {
    expect(result, 'driver result present').toBeDefined()
    const fixed = result as DriverResult
    const toPosix = (value: string): string => value.replaceAll('\\', '/')
    expect(toPosix(relative(root, fixed.module.path)), 'module path inside this repository')
      .toBe(toPosix(relative(root, triggerPath)))
    const bytes = await readFile(triggerPath)
    expect(fixed.module.sha256, 'module SHA-256 matches the working-tree trigger bytes')
      .toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(fixed.module.name).toBe('agent-team-teardown-trigger')
  })

  it('exited 0 with every scenario passing', () => {
    expect(exitCode).toBe(0)
    const fixed = result as DriverResult
    expect(fixed.ok).toBe(true)
    for (const scenario of fixed.scenarios) {
      expect(scenario.ok, `${scenario.name} scenario ok (${scenario.error})`).toBe(true)
    }
  })

  for (const scenarioName of Object.keys(REQUIRED_CHECKS)) {
    it(`${scenarioName}: pins its causal ordering checks`, () => {
      const fixed = result as DriverResult
      const scenario = fixed.scenarios.find(entry => entry.name === scenarioName)
      expect(scenario, `driver ran ${scenarioName}`).toBeDefined()
      const ran = scenario as DriverScenario
      for (const checkName of REQUIRED_CHECKS[scenarioName] as readonly string[]) {
        const check = ran.checks.find(entry => entry.name === checkName)
        expect(check, `${scenarioName} recorded ${checkName}`).toBeDefined()
        expect((check as DriverCheck).pass, `${scenarioName}/${(check as DriverCheck).name}: ${(check as DriverCheck).detail}`).toBe(true)
      }
    })
  }

  it('sent exactly one team message per scenario through the Lead', () => {
    const fixed = result as DriverResult
    for (const scenario of fixed.scenarios) {
      expect(scenario.sendCalls, `${scenario.name} sent once`).toHaveLength(1)
      expect(scenario.sendCalls[0]?.agentId, `${scenario.name} sender is the Lead`).toBe('r46-lead-session-0001')
      expect(scenario.sendCalls[0]?.target, `${scenario.name} target`).toBe('worker')
    }
  })
})
