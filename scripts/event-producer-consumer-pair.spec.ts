/**
 * Content-level consistency between the generated English event matrix and its
 * reviewed Chinese counterpart. The pairing record in
 * docs/event-producer-consumer.i18n.yaml proves the two sides were last
 * confirmed together, but a re-recorded pair silently blesses any drift, so
 * this spec compares the machine fields of both tables directly (event keys,
 * modes, declaration anchors, dispatcher and listener sets) after folding
 * paired-document locale link targets, and re-validates every declaration
 * anchor against the actual declaration line in source — a stale line number
 * or a dropped listener fails the top-level unit entry even when both sides
 * agree on the same wrong value. Prose, headings, and table header labels stay
 * language-owned and are not compared.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '..')
const enText = readFileSync(join(repoRoot, 'docs/event-producer-consumer.md'), 'utf8')
const zhText = readFileSync(join(repoRoot, 'docs/event-producer-consumer.zh.md'), 'utf8')

interface FactEntry {
  /** Package short name, from the link label or bare code span. */
  pkg: string
  /** Link target with paired-document locale folded away; null for bare spans. */
  url: string | null
  /** Dispatch method annotations, sorted. */
  methods: string[]
}

interface MatrixRow {
  event: string
  /** Dispatch mode; the undeclared-string table carries no mode column. */
  mode: string | null
  /** `path:line` declaration anchor plus its link target; null when absent. */
  declared: { source: string; url: string | null } | null
  dispatchers: FactEntry[]
  listeners: FactEntry[]
}

interface MatrixFacts {
  /** Section label ('' before the first heading) to its rows, in file order. */
  sections: Map<string, MatrixRow[]>
  /** Cells and shapes this parser no longer recognizes; format drift fails loud. */
  unparsed: string[]
}

/** Fold a paired-document locale target onto its source-language base name. */
function foldLocaleTarget(url: string): string {
  return url.replace(/\.zh\.md(?=#|$)/, '.md')
}

/** The `(`emit`)` method annotation the generator may append to any entry. */
const METHOD_NOTE = /^ \(((?:`[^`]+`(?:, )?)+)\)/

function entryMethods(rest: string): { methods: string[]; consumed: number } {
  const note = METHOD_NOTE.exec(rest)
  const methods = note?.[1] !== undefined ? note[1].split(', ').map(m => m.slice(1, -1)).sort() : []
  return { methods, consumed: note?.[0].length ?? 0 }
}

/**
 * Scan one package-list cell. Entries are `[`pkg`](url) (`method`, …)` or
 * `` `pkg` (`method`, …)`, separated by `', '`; `-` is the empty list.
 * Leftover text marks the whole cell unparseable rather than guessing at a
 * partial fact set.
 */
function parseEntryList(cell: string, unparsed: string[], where: string): FactEntry[] {
  if (cell === '-') return []
  const entries: FactEntry[] = []
  let rest = cell
  while (rest.length > 0) {
    if (entries.length > 0) {
      if (!rest.startsWith(', ')) {
        unparsed.push(`${where}: package list cell ${JSON.stringify(cell)}`)
        return []
      }
      rest = rest.slice(2)
    }
    const link = /^\[`([^`]+)`\]\(([^)]+)\)/.exec(rest)
    if (link?.[1] !== undefined && link[2] !== undefined) {
      const { methods, consumed } = entryMethods(rest.slice(link[0].length))
      entries.push({ pkg: link[1], url: foldLocaleTarget(link[2]), methods })
      rest = rest.slice(link[0].length + consumed)
      continue
    }
    const bare = /^`([^`]+)`/.exec(rest)
    if (bare?.[1] !== undefined) {
      const { methods, consumed } = entryMethods(rest.slice(bare[0].length))
      entries.push({ pkg: bare[1], url: null, methods })
      rest = rest.slice(bare[0].length + consumed)
      continue
    }
    unparsed.push(`${where}: package list cell ${JSON.stringify(cell)}`)
    return []
  }
  return entries
}

/** Parse one table row into facts. Wide rows carry mode and declared-in. */
function parseRow(cells: readonly string[], section: string, index: number, unparsed: string[]): MatrixRow {
  const where = `${section} row ${index}`
  const event = /^`([^`]+)`$/.exec(cells[0] ?? '')
  if (!event?.[1]) unparsed.push(`${where}: event cell ${JSON.stringify(cells[0])}`)
  // Column layout is part of the generated contract: five columns are the
  // declared-event matrix, three are the undeclared-string table.
  const wide = cells.length === 5
  let mode: string | null = null
  if (wide) {
    mode = /^`([^`]+)`$/.exec(cells[1] ?? '')?.[1] ?? null
    if (mode === null) unparsed.push(`${where}: mode cell ${JSON.stringify(cells[1])}`)
  }
  let declared: MatrixRow['declared'] = null
  if (wide) {
    const link = /^\[`([^`]+)`\]\(([^)]+)\)$/.exec(cells[2] ?? '')
    if (link?.[1] !== undefined && link[2] !== undefined) {
      declared = { source: link[1], url: foldLocaleTarget(link[2]) }
    } else {
      unparsed.push(`${where}: declared-in cell ${JSON.stringify(cells[2])}`)
    }
  }
  return {
    event: event?.[1] ?? '',
    mode,
    declared,
    dispatchers: parseEntryList(wide ? cells[3] ?? '' : cells[1] ?? '', unparsed, `${where} dispatchers`),
    listeners: parseEntryList(wide ? cells[4] ?? '' : cells[2] ?? '', unparsed, `${where} listeners`),
  }
}

/** Extract every table's machine facts from one side of the document pair. */
function parseMatrix(text: string): MatrixFacts {
  const facts: MatrixFacts = { sections: new Map(), unparsed: [] }
  let section = ''
  let block: string[][] = []
  const flush = (): void => {
    if (block.length === 0) return
    const [header, separator] = block
    const shaped = header !== undefined && separator !== undefined
      && header.length === separator.length
      && separator.every(cell => /^-{3,}$/.test(cell))
    if (shaped && (header.length === 5 || header.length === 3)) {
      for (const cells of block.slice(2)) {
        if (cells.length !== header.length) {
          facts.unparsed.push(`${section} table: row has ${cells.length} cells, expected ${header.length}`)
          continue
        }
        const rows = facts.sections.get(section) ?? []
        rows.push(parseRow(cells, section || 'table', rows.length + 1, facts.unparsed))
        facts.sections.set(section, rows)
      }
    } else {
      facts.unparsed.push(`pipe block under ${JSON.stringify(section)}: no recognized table header/separator shape`)
    }
    block = []
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('| ')) {
      block.push(line.split('|').slice(1, -1).map(cell => cell.trim()))
    } else {
      flush()
      if (line.startsWith('## ')) section = line.slice(3).trim()
    }
  }
  flush()
  return facts
}

/** Report every machine-field disagreement between the two language sides. */
function factDifferences(en: MatrixFacts, zh: MatrixFacts): string[] {
  const differences: string[] = []
  for (const text of ['en', 'zh'] as const) {
    for (const cell of (text === 'en' ? en : zh).unparsed) differences.push(`${text} ${cell}`)
  }
  const enSectionNames = [...en.sections.keys()]
  const zhSectionNames = [...zh.sections.keys()]
  for (const name of enSectionNames) {
    if (!zhSectionNames.includes(name)) differences.push(`section ${JSON.stringify(name)} missing in zh`)
  }
  for (const name of zhSectionNames) {
    if (!enSectionNames.includes(name)) differences.push(`section ${JSON.stringify(name)} missing in en`)
  }
  for (const [name, enRows] of en.sections) {
    const zhRows = zh.sections.get(name)
    if (!zhRows) continue
    if (enRows.length !== zhRows.length) {
      differences.push(`section ${JSON.stringify(name)}: ${enRows.length} rows in en vs ${zhRows.length} in zh`)
    }
    for (let i = 0; i < Math.min(enRows.length, zhRows.length); i++) {
      const a = enRows[i]
      const b = zhRows[i]
      // Unreachable under the Math.min bound; the explicit guard keeps the
      // impossible row pair fail-loud instead of asserting it away.
      if (a === undefined || b === undefined) {
        differences.push(`${name} row ${i + 1}: row present in one list only`)
        continue
      }
      const where = a.event || b.event || `${name} row ${i + 1}`
      if (a.event !== b.event) differences.push(`${where}: event key ${JSON.stringify(a.event)} vs ${JSON.stringify(b.event)}`)
      if (a.mode !== b.mode) differences.push(`${where}: mode ${JSON.stringify(a.mode)} vs ${JSON.stringify(b.mode)}`)
      if ((a.declared?.source ?? null) !== (b.declared?.source ?? null)) {
        differences.push(`${where}: declared source ${JSON.stringify(a.declared?.source)} vs ${JSON.stringify(b.declared?.source)}`)
      }
      if ((a.declared?.url ?? null) !== (b.declared?.url ?? null)) {
        differences.push(`${where}: declared link ${JSON.stringify(a.declared?.url)} vs ${JSON.stringify(b.declared?.url)}`)
      }
      for (const field of ['dispatchers', 'listeners'] as const) {
        if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) {
          differences.push(`${where}: ${field} ${JSON.stringify(a[field])} vs ${JSON.stringify(b[field])}`)
        }
      }
    }
  }
  return differences
}

/**
 * Report declaration anchors whose `path:line` does not sit on the event's
 * declaration line in the actual source. Catches both-sides-stale rows that a
 * two-language comparison alone would accept.
 */
function anchorViolations(facts: MatrixFacts, origin: string): string[] {
  const violations: string[] = []
  for (const rows of facts.sections.values()) {
    for (const row of rows) {
      if (!row.declared) continue
      const split = row.declared.source.lastIndexOf(':')
      const path = row.declared.source.slice(0, split)
      const line = Number(row.declared.source.slice(split + 1))
      if (split < 0 || !Number.isInteger(line) || line < 1) {
        violations.push(`${origin} ${row.event}: malformed anchor ${JSON.stringify(row.declared.source)}`)
        continue
      }
      let declaredLine: string | undefined
      try {
        declaredLine = readFileSync(join(repoRoot, path), 'utf8').split('\n')[line - 1]
      } catch {
        violations.push(`${origin} ${row.event}: anchor target ${path} is unreadable`)
        continue
      }
      const quoted = declaredLine !== undefined
        && ([`'${row.event}'`, `"${row.event}"`].some(candidate => declaredLine.includes(candidate)))
      if (!quoted) {
        violations.push(`${origin} ${row.event}: ${row.declared.source} is not its declaration line`)
      }
    }
  }
  return violations
}

function mutateLine(text: string, linePrefix: string, rewrite: (line: string) => string): string {
  return text.split('\n').map(line => (line.startsWith(linePrefix) ? rewrite(line) : line)).join('\n')
}

const staleZh = mutateLine(zhText, '| `agent-preset/selected` |', line =>
  line.replace('packages/preset/agent-presets/src/types.ts:82', 'packages/preset/agent-presets/src/types.ts:80'))
const listenerDroppedZh = mutateLine(zhText, '| `subagent/provider-added` |', line =>
  line.replace(', [`tool-subagent`](../packages/subagent/tool-subagent) |', ' |'))

describe('event-producer-consumer bilingual content check', () => {
  it('states identical machine facts in both languages of the committed matrix', () => {
    expect(factDifferences(parseMatrix(enText), parseMatrix(zhText))).toEqual([])
  })

  it('keeps every declared-in anchor on the event declaration line in source', () => {
    expect([
      ...anchorViolations(parseMatrix(enText), 'en'),
      ...anchorViolations(parseMatrix(zhText), 'zh'),
    ]).toEqual([])
  })

  it('rejects a restored stale declaration line number on one side', () => {
    const differences = factDifferences(parseMatrix(enText), parseMatrix(staleZh))
    expect(differences).toHaveLength(1)
    expect(differences[0]).toContain('agent-preset/selected: declared source')
    expect(differences[0]).toContain('types.ts:80')
  })

  it('rejects a listener dropped from one language', () => {
    const differences = factDifferences(parseMatrix(enText), parseMatrix(listenerDroppedZh))
    expect(differences).toHaveLength(1)
    expect(differences[0]).toContain('subagent/provider-added: listeners')
    expect(differences[0]).toContain('tool-subagent')
  })

  it('rejects a stale anchor even when both languages agree on it', () => {
    const staleEn = mutateLine(enText, '| `agent-preset/selected` |', line =>
      line.replace('packages/preset/agent-presets/src/types.ts:82', 'packages/preset/agent-presets/src/types.ts:80'))
    // Cross-language agreement holds; only the source-anchor check can object.
    expect(factDifferences(parseMatrix(staleEn), parseMatrix(staleZh))).toEqual([])
    expect([
      ...anchorViolations(parseMatrix(staleEn), 'en'),
      ...anchorViolations(parseMatrix(staleZh), 'zh'),
    ]).toHaveLength(2)
  })

  it('folds paired-document locale links but rejects other link drift', () => {
    const header = '| Event | Mode | Declared in | Dispatchers | Listeners |\n| --- | --- | --- | --- | --- |\n'
    const enRow = '| `x/y` | `emit` | [`packages/a/src/i.ts:10`](../packages/a/src/i.ts) | [`a`](../packages/a) (`emit`) | [`b`](../packages/b.md) |'
    const localeFoldedRow = '| `x/y` | `emit` | [`packages/a/src/i.ts:10`](../packages/a/src/i.ts) | [`a`](../packages/a) (`emit`) | [`b`](../packages/b.zh.md) |'
    const driftedRow = '| `x/y` | `emit` | [`packages/a/src/i.ts:10`](../packages/a/src/i.ts) | [`a`](../packages/a) (`emit`) | [`b`](../packages/c.md) |'
    expect(factDifferences(parseMatrix(header + enRow), parseMatrix(header + localeFoldedRow))).toEqual([])
    const differences = factDifferences(parseMatrix(header + enRow), parseMatrix(header + driftedRow))
    expect(differences).toHaveLength(1)
    expect(differences[0]).toContain('listeners')
  })
})
