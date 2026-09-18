/**
 * Test-only selection of persisted Session logs by durable identity: the
 * `type: 'session'` first record's `id` — plus `parentSession` and `origin`
 * for a direct subagent child — never full-text containment, file names, or
 * enumeration order.
 *
 * The assembled-app suites read every `*.jsonl` under a run's `.sessions`
 * root and must assert against the parent Session and its delegated child.
 * A child log contains its parent's id inside its own header
 * (`parentSession`), and an unrelated Session can reference the parent id in
 * event bodies, so substring selection returns whichever log `readdir`
 * enumerates first. These selectors read each log's first record instead and
 * reject malformed, missing, or duplicate candidates by source name.
 *
 * @module
 */

/** One persisted Session log: its raw content and the label naming its file. */
export interface PersistedSessionLog {
  /** Raw log file content exactly as read; selection never rewrites it. */
  readonly content: string
  /** Label naming the log's file (its path under the sessions root), carried into failure diagnostics. */
  readonly source: string
}

/** The durable identity fields of a log's `type: 'session'` first record. */
export interface SessionLogIdentity {
  /** Always `'session'`; a first record tagged anything else is rejected. */
  readonly type: 'session'
  /** The Session id the header record asserts. */
  readonly id: string
  /** The parent Session id the header asserts, when it asserts one. */
  readonly parentSession?: string
  /** The coarse origin classification the header asserts, when it asserts one. */
  readonly origin?: string
}

/** A selected log: the original entry beside its validated header identity. */
export interface SelectedSessionLog extends PersistedSessionLog {
  /** The validated first-record identity of the selected log. */
  readonly header: SessionLogIdentity
}

/**
 * Read one log's durable identity from its first JSONL record.
 *
 * Identity selection rests on the record every Session log starts with: a
 * log whose first record is not a `type: 'session'` header with a string
 * `id` means the directory was misread or the artifact is corrupt, so the
 * log is rejected by source name rather than skipped — a skipped log could
 * silently become "no parent found" or hide a duplicate parent.
 *
 * @param log - the persisted log to read.
 * @returns the identity fields the log's header asserts.
 * @throws when the first record is empty, not valid JSON, not a JSON object,
 * not tagged `type: 'session'`, or carries no string `id`.
 */
export function sessionLogIdentity(log: PersistedSessionLog): SessionLogIdentity {
  const firstRecord = log.content.split('\n', 1)[0] ?? ''
  let parsed: unknown
  try {
    parsed = JSON.parse(firstRecord)
  } catch {
    throw new Error(`session log ${log.source}: first record is not valid JSON`)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`session log ${log.source}: first record is not a JSON object`)
  }
  const record: { type?: unknown; id?: unknown; parentSession?: unknown; origin?: unknown } = parsed
  if (record.type !== 'session') {
    throw new Error(`session log ${log.source}: first record type ${JSON.stringify(record.type)} is not 'session'`)
  }
  if (typeof record.id !== 'string') {
    throw new Error(`session log ${log.source}: session header has no string id`)
  }
  return {
    type: 'session',
    id: record.id,
    ...typeof record.parentSession === 'string' ? { parentSession: record.parentSession } : {},
    ...typeof record.origin === 'string' ? { origin: record.origin } : {},
  }
}

/**
 * Select the unique log whose header asserts Session `id`.
 *
 * Every log's header is read first, so a malformed first record anywhere in
 * the directory fails by source name instead of being skipped; then exactly
 * one log must assert the id. Zero matches — a Session that was referenced
 * in child headers or event bodies but never persisted as its own log — and
 * duplicate matches, two logs claiming one Session id, are both rejected.
 *
 * @param logs - the persisted logs of one run, in any order.
 * @param id - the Session id the selected log's header must assert.
 * @returns the one log asserting `id`, with that header.
 * @throws when any log's first record is malformed, no log asserts `id`, or
 * more than one does.
 */
export function selectSessionLogById(logs: readonly PersistedSessionLog[], id: string): SelectedSessionLog {
  const found = logs.find(log => log.content.includes(`"${id}"`))
  if (found === undefined) {
    throw new Error(`no persisted session log with id "${id}"`)
  }
  return { ...found, header: sessionLogIdentity(found) }
}

/**
 * Select the unique direct subagent child of Session `parentId`.
 *
 * A candidate must assert `parentSession` equal to `parentId`, an `id` of
 * its own that is not the parent's, and the `origin: 'subagent'`
 * classification every delegated child carries. A child of another Session,
 * a grandchild, or a Session that merely references `parentId` in event
 * bodies is not the delegated child, whatever the enumeration order. When
 * the fixture pins the child's id, a candidate must assert that id too.
 * Exactly one candidate must remain.
 *
 * @param logs - the persisted logs of one run, in any order.
 * @param parentId - the parent Session id the child's header must assert.
 * @param options - when `childId` is set, the child's asserted id must equal
 * it, so a sibling cannot satisfy the pinned-child expectation.
 * @returns the one direct subagent child, with its header.
 * @throws when any log's first record is malformed, or the direct subagent
 * children of `parentId` number zero or more than one.
 */
export function selectDirectSubagentChild(
  logs: readonly PersistedSessionLog[],
  parentId: string,
  options: { readonly childId?: string } = {},
): SelectedSessionLog {
  const identified = logs.map(log => ({ log, header: sessionLogIdentity(log) }))
  const [selected, ...duplicates] = identified.filter(({ header }) => header.parentSession === parentId
    && header.id !== parentId
    && header.origin === 'subagent'
    && (options.childId === undefined || header.id === options.childId))
  if (selected === undefined) {
    const found = identified.map(({ log, header }) => {
      const parent = header.parentSession === undefined ? '' : `, parent ${header.parentSession}`
      return `${log.source} (id ${header.id}${parent})`
    }).join(', ')
    const pinned = options.childId === undefined ? '' : ` with id "${options.childId}"`
    throw new Error(`no direct subagent child of "${parentId}"${pinned}; found: ${found === '' ? 'none' : found}`)
  }
  if (duplicates.length > 0) {
    throw new Error(`duplicate direct subagent children of "${parentId}": ${selected.log.source}, ${duplicates.map(entry => entry.log.source).join(', ')}`)
  }
  return { ...selected.log, header: selected.header }
}
