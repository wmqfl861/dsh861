/**
 * W04 round-2 selection verification: generate a probe module that carries
 * the registry/selection block EXTRACTED VERBATIM from the live
 * snapshots/sdk/sdk.snapshot.ts source, run it under tsx with a shadowed
 * process.platform for win32 and linux, and assert the full truth table,
 * sidecar existence, and the win32 zero-change property against the W05-era
 * behavior.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const repo = 'C:/Albert/project/dsh861'
const source = await readFile(`${repo}/snapshots/sdk/sdk.snapshot.ts`, 'utf8')

const startMarker = 'const WIN32_PARENT_HEADER_SIDECARS: ReadonlySet<string> = new Set(['
const start = source.indexOf(startMarker)
if (start < 0) throw new Error('registry start marker not found')
const endMarker = 'interface PersistedLog {'
const end = source.indexOf(endMarker, start)
if (end < 0) throw new Error('registry end marker not found')
const block = source.slice(start, end)
for (const required of ['DEFAULT_PARENT_HEADER_SIDECARS', 'DEFAULT_CHILD_HEADER_SIDECARS', 'childSystemPromptSidecar']) {
  if (!block.includes(required)) throw new Error(`extracted block is missing ${required}`)
}

const probe = `/**
 * GENERATED W04 round-2 selection probe — the block between the markers is
 * byte-verbatim from snapshots/sdk/sdk.snapshot.ts. Do not edit by hand.
 */
import { join } from 'node:path'

const PLATFORM = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PROBE_PLATFORM
if (PLATFORM !== 'win32' && PLATFORM !== 'linux') throw new Error('PROBE_PLATFORM must be win32 or linux')
const process = { platform: PLATFORM }

interface CorpusScenario { readonly key: string; readonly dir: string }

${block}
const scenarios = {
  sub: { key: 'sdk/subagent-teardown', dir: 'C:/probe/subagent-teardown' },
  team: { key: 'sdk/agent-team-teardown', dir: 'C:/probe/agent-team-teardown' },
  unreg: { key: 'sdk/text-turn', dir: 'C:/probe/text-turn' },
} satisfies Record<string, CorpusScenario>
const shared = { key: 'session/text-turn', dir: 'C:/probe-shared' } satisfies CorpusScenario

let checks = 0
function expectPath(actual: string, expected: string, label: string): void {
  checks++
  if (actual.replaceAll('\\\\', '/') !== expected.replaceAll('\\\\', '/')) {
    throw new Error(\`\${PLATFORM} \${label}: expected \${expected} got \${actual}\`)
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
console.log(\`selection probe [\${PLATFORM}]: \${checks} path checks passed\`)
`

const probePath = 'C:/dsh-b01-w04/round2/selection-probe.generated.mts'
await writeFile(probePath, probe)

// Existence audit of every sidecar the two registered scenarios select on
// this machine, plus the shared sources (dir names restored to the real repo).
const repoPaths = [
  'snapshots/sdk/subagent-teardown/tool-schemas.win32.expected.json',
  'snapshots/sdk/subagent-teardown/system-prompt.win32.expected.md',
  'snapshots/sdk/subagent-teardown/tool-schemas.1.win32.expected.json',
  'snapshots/sdk/subagent-teardown/system-prompt.1.expected.md',
  'snapshots/sdk/subagent-teardown/tool-schemas.1.default.expected.json',
  'snapshots/sdk/subagent-teardown/system-prompt.1.default.expected.md',
  'snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json',
  'snapshots/sdk/agent-team-teardown/system-prompt.win32.expected.md',
  'snapshots/sdk/agent-team-teardown/tool-schemas.1.win32.expected.json',
  'snapshots/sdk/agent-team-teardown/system-prompt.1.expected.md',
  'snapshots/sdk/agent-team-teardown/tool-schemas.default.expected.json',
  'snapshots/sdk/agent-team-teardown/system-prompt.default.expected.md',
  'snapshots/sdk/agent-team-teardown/tool-schemas.1.default.expected.json',
  'snapshots/sdk/agent-team-teardown/system-prompt.1.default.expected.md',
  'snapshots/session/text-turn/tool-schemas.expected.json',
  'snapshots/session/text-turn/system-prompt.expected.md',
]
const missing = repoPaths.filter(p => !existsSync(`${repo}/${p}`))
if (missing.length > 0) throw new Error(`missing sidecars: ${missing.join(', ')}`)
console.log(`existence audit: ${repoPaths.length} sidecars present`)
