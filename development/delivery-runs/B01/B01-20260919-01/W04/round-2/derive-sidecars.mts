/**
 * W04 round-2 derivation + cross-validation:
 *  - agent-team parent Linux (run 42) vs the win32 capture must differ only
 *    in the bash/pwsh entry.
 *  - agent-team child default schema = parent default schema (parent/child
 *    toolset identity, byte-proven on win32 in round 1).
 *  - Linux prompt sidecars: mechanical section swap on the win32 prompt
 *    sidecars (Windows-kill shell section -> the shared text-turn bash
 *    section), the basis CI itself evidenced (subagent parent prompts passed
 *    on Linux against text-turn in run 42).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const repo = 'C:/Albert/project/dsh861'
const derived = 'C:/dsh-b01-w04/round2/derived'

const PWSH_SECTION = 'Non-zero exits are reported as `[exit code: N]` markers; investigate failures before moving on. On Windows a killed process settles as `[exit code: 1]` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure.'
const BASH_SECTION = 'Check the [exit code: N] marker on every bash result; investigate failures before moving on.'

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sorted(v)]))
  }
  return value
}
const structural = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

// --- cross-validation: agent-team parent Linux vs win32 capture ---
{
  const linux = JSON.parse(await readFile(join(derived, 'agent-team-teardown.tool-schemas.default.candidate.json'), 'utf8')) as { initial: unknown[] }
  const win32 = JSON.parse(await readFile(join(repo, 'snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json'), 'utf8')) as { initial: unknown[] }
  const linuxNames = new Map((linux.initial as { name: string }[]).map(t => [t.name, t]))
  const win32Names = new Map((win32.initial as { name: string }[]).map(t => [t.name, t]))
  const onlyLinux = [...linuxNames.keys()].filter(n => !win32Names.has(n))
  const onlyWin32 = [...win32Names.keys()].filter(n => !linuxNames.has(n))
  if (JSON.stringify(onlyLinux) !== '["bash"]' || JSON.stringify(onlyWin32) !== '["pwsh"]') {
    throw new Error(`agent-team parent Linux vs win32 differ beyond the shell entry: +${JSON.stringify(onlyLinux)} -${JSON.stringify(onlyWin32)}`)
  }
  let drifted: string[] = []
  for (const [name, tool] of linuxNames) {
    if (name === 'bash') continue
    if (!structural(tool, win32Names.get(name))) drifted.push(name)
  }
  if (drifted.length > 0) throw new Error(`shared tools drifted between Linux and win32 captures: ${drifted.join(',')}`)
  console.log('agent-team parent: Linux vs win32 differ ONLY in bash<->pwsh; 30 shared tools structurally identical')

  // agent-team child default schema = parent default schema (identity basis).
  await writeFile(join(derived, 'agent-team-teardown.tool-schemas.1.default.candidate.json'),
    await readFile(join(derived, 'agent-team-teardown.tool-schemas.default.candidate.json'), 'utf8'))
  const win32ParentChildIdentical = structural(
    JSON.parse(await readFile(join(repo, 'snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json'), 'utf8')).initial,
    JSON.parse(await readFile(join(repo, 'snapshots/sdk/agent-team-teardown/tool-schemas.1.win32.expected.json'), 'utf8')).initial,
  )
  if (!win32ParentChildIdentical) throw new Error('win32 agent-team parent/child schema identity no longer holds; derivation basis broken')
  console.log('agent-team child default schema = parent default schema (identity basis: win32 parent/child byte-identity re-verified)')
}

// --- Linux prompt sidecars: mechanical section swap ---
async function derivePrompt(label: string, sourcePath: string, outName: string): Promise<void> {
  const source = await readFile(sourcePath, 'utf8')
  const occurrences = source.split(PWSH_SECTION).length - 1
  if (occurrences !== 1) throw new Error(`${label}: expected exactly 1 Windows-kill section, found ${occurrences}`)
  await writeFile(join(derived, outName), source.replace(PWSH_SECTION, BASH_SECTION))
  console.log(`${label}: section swapped -> ${outName}`)
}

await derivePrompt('subagent child prompt (win32 child sidecar base)',
  join(repo, 'snapshots/sdk/subagent-teardown/system-prompt.1.expected.md'),
  'subagent-teardown.system-prompt.1.default.candidate.md')
await derivePrompt('agent-team parent prompt (win32 parent sidecar base)',
  join(repo, 'snapshots/sdk/agent-team-teardown/system-prompt.win32.expected.md'),
  'agent-team-teardown.system-prompt.default.candidate.md')
await derivePrompt('agent-team child prompt (win32 child sidecar base)',
  join(repo, 'snapshots/sdk/agent-team-teardown/system-prompt.1.expected.md'),
  'agent-team-teardown.system-prompt.1.default.candidate.md')

// --- validation: subagent derived child prompt should equal the text-turn prompt byte-for-byte ---
{
  const derivedChild = await readFile(join(derived, 'subagent-teardown.system-prompt.1.default.candidate.md'), 'utf8')
  const textTurn = await readFile(join(repo, 'snapshots/session/text-turn/system-prompt.expected.md'), 'utf8')
  console.log(`subagent derived child prompt == text-turn shared prompt (byte-for-byte): ${derivedChild === textTurn}`)
  if (derivedChild !== textTurn) {
    const a = derivedChild.split('\n'); const b = textTurn.split('\n')
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) { console.log(`first diff at line ${i + 1}:\n  derived:   ${JSON.stringify(a[i])}\n  text-turn: ${JSON.stringify(b[i])}`); break }
    }
  }
}
