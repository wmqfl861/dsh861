/**
 * W04 round-2 negative controls (rehearsal form for the non-win32 sidecars):
 * the Linux header assertion cannot run on this win32 machine, so each new
 * `.default` schema sidecar is exercised through the SAME loaders and the
 * SAME deep-equality semantics the lane uses, against the REAL run-42
 * received tools: unmutated must compare equal (round-trip fidelity), a
 * one-field mutation must be rejected.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseToolSchemasSnapshot } from '@deepseek-ai/dsh-session-snapshot'

const repo = 'C:/Albert/project/dsh861'
const derived = 'C:/dsh-b01-w04/round2/derived'

const pinConfig = async (scenario: string): Promise<unknown> => {
  const fixture = await readFile(join(repo, 'snapshots/sdk', scenario, 'session.v3.jsonl'), 'utf8')
  for (const line of fixture.split('\n')) {
    if (line.trim() === '') continue
    const record = JSON.parse(line) as { type?: string; data?: { header?: { config?: unknown } } }
    if (record.type === 'request/header') return record.data?.header?.config
  }
  throw new Error(`${scenario}: no request/header config`)
}

function structuralEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function run(label: string, sidecarPath: string, receivedTools: unknown[], config: unknown): Promise<void> {
  const snapshot = await readFile(sidecarPath, 'utf8')
  const parsed = parseToolSchemasSnapshot(snapshot)
  const expectedHeader = { config, tools: parsed.initial }
  const receivedHeader = { config, tools: receivedTools }
  if (!structuralEqual(expectedHeader, receivedHeader)) {
    throw new Error(`${label}: POSITIVE rehearsal failed — sidecar does not carry the run-42 received set`)
  }
  // Mutation 1: description field of the bash tool.
  const mutatedDescription = structuredClone(parsed.initial) as { name?: string; description?: string }[]
  const bash = mutatedDescription.find(t => t.name === 'bash')
  if (bash === undefined) throw new Error(`${label}: no bash tool to mutate`)
  bash.description = `MUTATED ${String(bash.description?.slice(0, 60))}`
  if (structuralEqual({ config, tools: mutatedDescription }, receivedHeader)) {
    throw new Error(`${label}: description mutation was NOT rejected`)
  }
  // Mutation 2: an input-schema field (required array of the bash tool).
  const mutatedRequired = structuredClone(parsed.initial) as {
    name?: string
    parameters?: { required?: string[] }
  }[]
  const bash2 = mutatedRequired.find(t => t.name === 'bash')
  if (bash2?.parameters?.required === undefined) throw new Error(`${label}: bash has no required array`)
  bash2.parameters.required = bash2.parameters.required.slice(0, 1)
  if (structuralEqual({ config, tools: mutatedRequired }, receivedHeader)) {
    throw new Error(`${label}: input-schema mutation was NOT rejected`)
  }
  console.log(`${label}: positive round-trip OK; description mutation rejected; input-schema mutation rejected`)
}

const subConfig = await pinConfig('subagent-teardown')
const teamConfig = await pinConfig('agent-team-teardown')

const subChildReceived = parseToolSchemasSnapshot(await readFile(join(derived, 'subagent-teardown.tool-schemas.1.default.candidate.json'), 'utf8')).initial
const teamParentReceived = parseToolSchemasSnapshot(await readFile(join(derived, 'agent-team-teardown.tool-schemas.default.candidate.json'), 'utf8')).initial

await run('NC-R2a subagent child .default schema',
  join(repo, 'snapshots/sdk/subagent-teardown/tool-schemas.1.default.expected.json'),
  subChildReceived, subConfig)
await run('NC-R2b agent-team parent .default schema',
  join(repo, 'snapshots/sdk/agent-team-teardown/tool-schemas.default.expected.json'),
  teamParentReceived, teamConfig)
await run('NC-R2c agent-team child .default schema (derived = parent received)',
  join(repo, 'snapshots/sdk/agent-team-teardown/tool-schemas.1.default.expected.json'),
  teamParentReceived, teamConfig)

// --- prompt sidecars ---
{
  const textTurn = await readFile(join(repo, 'snapshots/session/text-turn/system-prompt.expected.md'), 'utf8')
  const derivedSubChild = await readFile(join(repo, 'snapshots/sdk/subagent-teardown/system-prompt.1.default.expected.md'), 'utf8')
  if (derivedSubChild !== textTurn) throw new Error('NC-R2d positive failed: subagent derived child prompt != text-turn reference')
  const mutated = derivedSubChild.replace('Check the [exit code: N] marker', 'MUTATED Check the [exit code: N] marker')
  if (mutated === textTurn) throw new Error('NC-R2d: prompt mutation was NOT rejected against the text-turn reference')
  console.log('NC-R2d subagent child .default prompt: byte-equal to the text-turn reference; one-word mutation rejected')
}
{
  const unmutated = await readFile(join(repo, 'snapshots/sdk/agent-team-teardown/system-prompt.default.expected.md'), 'utf8')
  const mutated = unmutated.replace('Check the [exit code: N] marker', 'MUTATED Check the [exit code: N] marker')
  if (mutated === unmutated) throw new Error('NC-R2e: mutation did not change the file')
  // The lane compares prompt text by exact string equality; any byte change
  // flips it. No independent Linux received text exists pre-CI, so this
  // control demonstrates non-vacuity of the equality, with CI authoritative.
  console.log('NC-R2e agent-team parent .default prompt: exact-equality control is non-vacuous (one-word mutation changes the compared bytes)')
}
