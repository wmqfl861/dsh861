/**
 * GENERATED W04 round-2 selection probe — the block between the markers is
 * byte-verbatim from snapshots/sdk/sdk.snapshot.ts. Do not edit by hand.
 */
import { join } from 'node:path'

const PLATFORM = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PROBE_PLATFORM
if (PLATFORM !== 'win32' && PLATFORM !== 'linux') throw new Error('PROBE_PLATFORM must be win32 or linux')
const process = { platform: PLATFORM }

interface CorpusScenario { readonly key: string; readonly dir: string }

const WIN32_PARENT_HEADER_SIDECARS: ReadonlySet<string> = new Set([
  'sdk/subagent-teardown',
  'sdk/agent-team-teardown',
])

/**
 * Scenarios whose non-win32 parent header also diverges from the shared
 * class-pin sources: the team composition mounts team tools and team prompt
 * guidance on every platform, so non-win32 runs read explicit `.default`
 * parent sidecars from the scenario directory. `sdk/subagent-teardown` is
 * absent: CI run 42 (Linux, 35450138445) compared its parent schemas and
 * parent prompt against the shared `session/text-turn` sources and passed.
 */
const DEFAULT_PARENT_HEADER_SIDECARS: ReadonlySet<string> = new Set([
  'sdk/agent-team-teardown',
])

/**
 * Scenarios whose child sidecars are platform-gated on every platform: the
 * child assembles the platform shell tool (its schema and prompt section),
 * so non-win32 runs read `.default` child sidecars while win32 keeps the
 * unsuffixed child sidecars committed by r46 — whose bytes are win32
 * captures. The `.default` child bytes come from run 42's real Linux
 * received headers and the prompt-section derivations documented in the W04
 * round-2 evidence.
 */
const DEFAULT_CHILD_HEADER_SIDECARS: ReadonlySet<string> = new Set([
  'sdk/subagent-teardown',
  'sdk/agent-team-teardown',
])

function win32ParentHeaderSidecar(scenario: CorpusScenario): boolean {
  return process.platform === 'win32' && WIN32_PARENT_HEADER_SIDECARS.has(scenario.key)
}

function defaultParentHeaderSidecar(scenario: CorpusScenario): boolean {
  return process.platform !== 'win32' && DEFAULT_PARENT_HEADER_SIDECARS.has(scenario.key)
}

function defaultChildHeaderSidecar(scenario: CorpusScenario): boolean {
  return process.platform !== 'win32' && DEFAULT_CHILD_HEADER_SIDECARS.has(scenario.key)
}

/** The parent (class-pin) tool-schema sidecar for the running platform. */
function parentToolSchemasSidecar(scenario: CorpusScenario, schemaOwner: CorpusScenario): string {
  if (win32ParentHeaderSidecar(scenario)) return join(scenario.dir, 'tool-schemas.win32.expected.json')
  if (defaultParentHeaderSidecar(scenario)) return join(scenario.dir, 'tool-schemas.default.expected.json')
  return join(schemaOwner.dir, 'tool-schemas.expected.json')
}

/** The parent (class-pin) system-prompt sidecar for the running platform. */
function parentSystemPromptSidecar(scenario: CorpusScenario, promptOwner: CorpusScenario): string {
  if (win32ParentHeaderSidecar(scenario)) return join(scenario.dir, 'system-prompt.win32.expected.md')
  if (defaultParentHeaderSidecar(scenario)) return join(scenario.dir, 'system-prompt.default.expected.md')
  return join(promptOwner.dir, 'system-prompt.expected.md')
}

/** One child tool-schema sidecar for the running platform. */
function childToolSchemasSidecar(scenario: CorpusScenario, index: number): string {
  if (win32ParentHeaderSidecar(scenario)) return join(scenario.dir, `tool-schemas.${index}.win32.expected.json`)
  if (defaultChildHeaderSidecar(scenario)) return join(scenario.dir, `tool-schemas.${index}.default.expected.json`)
  return join(scenario.dir, `tool-schemas.${index}.expected.json`)
}

/** One child system-prompt sidecar for the running platform. */
function childSystemPromptSidecar(scenario: CorpusScenario, index: number): string {
  if (defaultChildHeaderSidecar(scenario)) return join(scenario.dir, `system-prompt.${index}.default.expected.md`)
  return join(scenario.dir, `system-prompt.${index}.expected.md`)
}


const scenarios = {
  sub: { key: 'sdk/subagent-teardown', dir: 'C:/probe/subagent-teardown' },
  team: { key: 'sdk/agent-team-teardown', dir: 'C:/probe/agent-team-teardown' },
  unreg: { key: 'sdk/text-turn', dir: 'C:/probe/text-turn' },
} satisfies Record<string, CorpusScenario>
const shared = { key: 'session/text-turn', dir: 'C:/probe-shared' } satisfies CorpusScenario

let checks = 0
function expectPath(actual: string, expected: string, label: string): void {
  checks++
  if (actual.replaceAll('\\', '/') !== expected.replaceAll('\\', '/')) {
    throw new Error(`${PLATFORM} ${label}: expected ${expected} got ${actual}`)
  }
}

if (PLATFORM === 'win32') {
  // Zero-change proof: every expected value below is exactly what the W05-era
  // selection produced (three ternary functions + the plain child-prompt name).
  expectPath(parentToolSchemasSidecar(scenarios.sub, shared), 'C:/probe/subagent-teardown/tool-schemas.win32.expected.json', 'sub parent schemas')
  expectPath(parentSystemPromptSidecar(scenarios.sub, shared), 'C:/probe/subagent-teardown/system-prompt.win32.expected.md', 'sub parent prompt')
  expectPath(childToolSchemasSidecar(scenarios.sub, 1), 'C:/probe/subagent-teardown/tool-schemas.1.win32.expected.json', 'sub child schemas')
  expectPath(childSystemPromptSidecar(scenarios.sub, 1), 'C:/probe/subagent-teardown/system-prompt.1.expected.md', 'sub child prompt')
  expectPath(parentToolSchemasSidecar(scenarios.team, shared), 'C:/probe/agent-team-teardown/tool-schemas.win32.expected.json', 'team parent schemas')
  expectPath(parentSystemPromptSidecar(scenarios.team, shared), 'C:/probe/agent-team-teardown/system-prompt.win32.expected.md', 'team parent prompt')
  expectPath(childToolSchemasSidecar(scenarios.team, 1), 'C:/probe/agent-team-teardown/tool-schemas.1.win32.expected.json', 'team child schemas')
  expectPath(childSystemPromptSidecar(scenarios.team, 1), 'C:/probe/agent-team-teardown/system-prompt.1.expected.md', 'team child prompt')
  expectPath(parentToolSchemasSidecar(scenarios.unreg, shared), 'C:/probe-shared/tool-schemas.expected.json', 'unreg parent schemas')
  expectPath(parentSystemPromptSidecar(scenarios.unreg, shared), 'C:/probe-shared/system-prompt.expected.md', 'unreg parent prompt')
  expectPath(childToolSchemasSidecar(scenarios.unreg, 2), 'C:/probe/text-turn/tool-schemas.2.expected.json', 'unreg child schemas')
  expectPath(childSystemPromptSidecar(scenarios.unreg, 2), 'C:/probe/text-turn/system-prompt.2.expected.md', 'unreg child prompt')
} else {
  expectPath(parentToolSchemasSidecar(scenarios.sub, shared), 'C:/probe-shared/tool-schemas.expected.json', 'sub parent schemas (shared)')
  expectPath(parentSystemPromptSidecar(scenarios.sub, shared), 'C:/probe-shared/system-prompt.expected.md', 'sub parent prompt (shared)')
  expectPath(childToolSchemasSidecar(scenarios.sub, 1), 'C:/probe/subagent-teardown/tool-schemas.1.default.expected.json', 'sub child schemas')
  expectPath(childSystemPromptSidecar(scenarios.sub, 1), 'C:/probe/subagent-teardown/system-prompt.1.default.expected.md', 'sub child prompt')
  expectPath(parentToolSchemasSidecar(scenarios.team, shared), 'C:/probe/agent-team-teardown/tool-schemas.default.expected.json', 'team parent schemas')
  expectPath(parentSystemPromptSidecar(scenarios.team, shared), 'C:/probe/agent-team-teardown/system-prompt.default.expected.md', 'team parent prompt')
  expectPath(childToolSchemasSidecar(scenarios.team, 1), 'C:/probe/agent-team-teardown/tool-schemas.1.default.expected.json', 'team child schemas')
  expectPath(childSystemPromptSidecar(scenarios.team, 1), 'C:/probe/agent-team-teardown/system-prompt.1.default.expected.md', 'team child prompt')
  expectPath(parentToolSchemasSidecar(scenarios.unreg, shared), 'C:/probe-shared/tool-schemas.expected.json', 'unreg parent schemas')
  expectPath(parentSystemPromptSidecar(scenarios.unreg, shared), 'C:/probe-shared/system-prompt.expected.md', 'unreg parent prompt')
  expectPath(childToolSchemasSidecar(scenarios.unreg, 2), 'C:/probe/text-turn/tool-schemas.2.expected.json', 'unreg child schemas')
  expectPath(childSystemPromptSidecar(scenarios.unreg, 2), 'C:/probe/text-turn/system-prompt.2.expected.md', 'unreg child prompt')
}
console.log(`selection probe [${PLATFORM}]: ${checks} path checks passed`)
