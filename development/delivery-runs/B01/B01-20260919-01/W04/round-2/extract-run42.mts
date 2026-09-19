/**
 * W04 round-2 extraction: reconstruct the Linux RECEIVED header objects from
 * run 42's real assertion diffs (logs/snapshot.log, run 35450138445).
 *
 * Method: the vitest diff is a unified diff over both sides printed as
 * sorted-key, 2-space JSON. The expected side is rebuilt from the same repo
 * files the lane reads (pin fixture header + expectation sidecar), every hunk
 * anchor/context line is verified against it, then the diff is applied to
 * yield the received side, which is JSON-parsed. No content is hand-written.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { formatToolSchemasSnapshot } from '@deepseek-ai/dsh-session-snapshot'

const repo = 'C:/Albert/project/dsh861'
const logPath = 'C:/dsh-b01-w03/gate-evidence-run42/logs/snapshot.log'
const outRoot = 'C:/dsh-b01-w04/round2/derived'

const ANSI = /\u001b\[[0-9;]*m/g
const raw = (await readFile(logPath, 'utf8')).replace(ANSI, '')

/** Recursively sort object keys; arrays keep order. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sorted(v)]))
  }
  return value
}

/** The first request/header payload of a session fixture, with its tools token. */
function pinHeader(fixture: string): Record<string, unknown> {
  for (const line of fixture.split('\n')) {
    if (line.trim() === '') continue
    const record = JSON.parse(line) as { type?: string; data?: { header?: unknown } }
    if (record.type === 'request/header') {
      const header = record.data?.header as Record<string, unknown>
      if (header === undefined) throw new Error('pin fixture has a request/header without data.header')
      return header
    }
  }
  throw new Error('pin fixture has no request/header')
}

interface FailureBlock {
  scenario: string
  hunks: { aStart: number; bStart: number; lines: { mark: ' ' | '-' | '+'; text: string }[] }[]
}

/** Parse the FAIL blocks with their unified diffs from the stripped log. */
function parseBlocks(text: string): FailureBlock[] {
  const lines = text.split(/\r?\n/)
  const blocks: FailureBlock[] = []
  let current: FailureBlock | undefined
  let inDiff = false
  for (const line of lines) {
    const fail = /^ FAIL .*replays (subagent-teardown|agent-team-teardown) through/.exec(line)
    if (fail !== null) {
      current = { scenario: fail[1] as string, hunks: [] }
      blocks.push(current)
      inDiff = false
      continue
    }
    if (current === undefined) continue
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk !== null) {
      current.hunks.push({ aStart: Number(hunk[1]), bStart: Number(hunk[2]), lines: [] })
      inDiff = true
      continue
    }
    if (inDiff && current.hunks.length > 0) {
      // Vitest prints the diff one space deeper than the source lines and
      // closes the block with stack frames (` ❯ …`, `  771| …`) or dividers.
      if (/^ ❯/.test(line) || /^\s*\d+\|/.test(line) || line.startsWith('⎯') || /^-{7,}$/.test(line)) {
        inDiff = false
        continue
      }
      const mark = line[0]
      if (mark === ' ' || mark === '-' || mark === '+') {
        const rest = line.slice(1)
        const content = rest.startsWith(' ') ? rest.slice(1) : rest
        current.hunks[current.hunks.length - 1]?.lines.push({ mark, text: content })
        continue
      }
      if (line.trim() !== '') inDiff = false
    }
  }
  return blocks
}

/**
 * The assertion diff prints both sides in a display format: every member line
 * carries a trailing comma — including each container's final member, unlike
 * JSON. Transform a plain pretty-print into that format so hunk anchors and
 * context can be verified line-exactly.
 */
function toPrinterFormat(lines: string[]): string[] {
  return lines.map((line, index) => {
    if (index === lines.length - 1) return line
    if (line.endsWith(',') || line.endsWith('{') || line.endsWith('[')) return line
    return `${line},`
  })
}

/** Inverse of the display format, line-based so string content is untouched: drop a line-final comma when the next line closes the container. */
function fromPrinterFormat(lines: string[]): string[] {
  return lines.map((line, index) => {
    const next = lines[index + 1]
    if (line.endsWith(',') && next !== undefined && /^\s*[}\]]/.test(next)) return line.slice(0, -1)
    return line
  })
}

/** Apply unified hunks to the expected line array, verifying every context and deletion line. */
function applyDiff(expectedLines: string[], hunks: FailureBlock['hunks'], label: string): string[] {
  const received: string[] = []
  let cursor = 0 // 0-based index into expectedLines
  for (const hunk of hunks) {
    const aIndex = hunk.aStart - 1
    if (aIndex < cursor) throw new Error(`${label}: overlapping hunk at expected line ${hunk.aStart}`)
    // Verify the gap since the previous hunk is untouched, then copy it.
    for (let i = cursor; i < aIndex; i++) received.push(expectedLines[i] as string)
    cursor = aIndex
    for (const entry of hunk.lines) {
      if (entry.mark === ' ') {
        const expectedLine = expectedLines[cursor]
        if (expectedLine !== entry.text) {
          throw new Error(`${label}: context mismatch at expected line ${cursor + 1}:`
            + ` expected ${JSON.stringify(expectedLine)} diff says ${JSON.stringify(entry.text)}`)
        }
        received.push(entry.text)
        cursor++
      } else if (entry.mark === '-') {
        const expectedLine = expectedLines[cursor]
        if (expectedLine !== entry.text) {
          throw new Error(`${label}: deletion mismatch at expected line ${cursor + 1}:`
            + ` expected ${JSON.stringify(expectedLine)} diff says ${JSON.stringify(entry.text)}`)
        }
        cursor++
      } else {
        received.push(entry.text)
      }
    }
  }
  for (let i = cursor; i < expectedLines.length; i++) received.push(expectedLines[i] as string)
  return received
}

const blocks = parseBlocks(raw)
if (blocks.length !== 2) throw new Error(`expected 2 FAIL blocks, got ${blocks.length}: ${blocks.map(b => b.scenario).join(',')}`)

const textTurnSchemas = JSON.parse(await readFile(join(repo, 'snapshots/session/text-turn/tool-schemas.expected.json'), 'utf8')) as { initial: unknown[] }

async function reconstruct(scenario: string, expectedObject: Record<string, unknown>): Promise<{ header: Record<string, unknown>; tools: unknown[] }> {
  const block = blocks.find(b => b.scenario === scenario)
  if (block === undefined) throw new Error(`no FAIL block for ${scenario}`)
  const expectedLines = toPrinterFormat(JSON.stringify(sorted(expectedObject), null, 2).split('\n'))
  const receivedLines = applyDiff(expectedLines, block.hunks, scenario)
  const json = fromPrinterFormat(receivedLines).join('\n')
  const received = JSON.parse(json) as Record<string, unknown>
  const tools = received.tools
  if (!Array.isArray(tools)) throw new Error(`${scenario}: received has no tools array`)
  return { header: received, tools }
}

// --- agent-team parent: expected = own pin header (config) + text-turn schemas ---
{
  const fixture = await readFile(join(repo, 'snapshots/sdk/agent-team-teardown/session.v3.jsonl'), 'utf8')
  const header = pinHeader(fixture)
  const keys = Object.keys(header)
  if (keys.length !== 2 || keys.includes('tools') !== true) {
    throw new Error(`agent-team pin header keys: ${keys.join(',')}`)
  }
  const expected = { config: header.config, tools: textTurnSchemas.initial }
  const { header: received, tools } = await reconstruct('agent-team-teardown', expected)
  if (received.config === undefined) throw new Error('agent-team received has no config')
  const names = (tools as { name?: unknown }[]).map(t => String(t.name))
  const pwshIdx = names.indexOf('pwsh'); const bashIdx = names.indexOf('bash')
  if (bashIdx < 0 || pwshIdx >= 0) throw new Error(`agent-team parent Linux set must contain bash and not pwsh: bash=${bashIdx} pwsh=${pwshIdx}`)
  await writeFile(join(outRoot, 'agent-team-teardown.tool-schemas.default.candidate.json'),
    formatToolSchemasSnapshot(tools, []))
  console.log(`agent-team parent: ${tools.length} tools; team tools present:`
    + ` ${['spawn_teammate', 'team_task_create', 'team_task_get', 'team_task_list', 'team_task_update', 'wait_agent'].every(n => names.includes(n))}`)
}

// --- subagent child: expected = own pin header (config) + frozen child sidecar ---
{
  const fixture = await readFile(join(repo, 'snapshots/sdk/subagent-teardown/session.v3.jsonl'), 'utf8')
  const header = pinHeader(fixture)
  const frozen = JSON.parse(await readFile(join(repo, 'snapshots/sdk/subagent-teardown/tool-schemas.1.expected.json'), 'utf8')) as { initial: unknown[] }
  const expected = { config: header.config, tools: frozen.initial }
  const { tools } = await reconstruct('subagent-teardown', expected)
  const names = (tools as { name?: unknown }[]).map(t => String(t.name))
  if (!names.includes('bash') || names.includes('pwsh')) throw new Error('subagent child Linux set must contain bash and not pwsh')
  await writeFile(join(outRoot, 'subagent-teardown.tool-schemas.1.default.candidate.json'),
    formatToolSchemasSnapshot(tools, []))
  const same = JSON.stringify(sorted(tools)) === JSON.stringify(sorted(textTurnSchemas.initial))
  console.log(`subagent child: ${tools.length} tools; structurally equal to text-turn shared set: ${same}`)
}
