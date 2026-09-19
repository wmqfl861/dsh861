/**
 * Deterministic regressions for the test-only Session-log identity selectors:
 * every enumeration order, reference-only and cross-parent decoys, malformed
 * or duplicate first records, and input immutability. The same helpers back
 * the assembled-app subagent suites' log selection.
 */

import { describe, expect, it } from 'vitest'
import {
  selectDirectSubagentChild,
  selectSessionLogById,
  type PersistedSessionLog,
} from './session-log-identity.ts'

const PARENT_ID = 'fixture-parent'
const CHILD_ID = 'fixture-child'
const OTHER_PARENT_ID = 'other-parent'
const OTHER_CHILD_ID = 'other-child'
const GRANDCHILD_ID = 'fixture-grandchild'

const header = (fields: Record<string, unknown>): string => JSON.stringify(fields)
const logOf = (source: string, headerFields: Record<string, unknown>, events: Record<string, unknown>[] = []): PersistedSessionLog => ({
  source,
  content: [header(headerFields), ...events.map(event => JSON.stringify(event))].join('\n') + '\n',
})
const parentLog = (): PersistedSessionLog => logOf('parent.jsonl', {
  type: 'session', version: 3, id: PARENT_ID, createdAt: 1, cwd: '/workspace', isSeeded: false, delegationDepth: 0,
})
const childLog = (source = 'child.jsonl', id = CHILD_ID, parent = PARENT_ID): PersistedSessionLog => logOf(source, {
  type: 'session', version: 3, id, createdAt: 2, cwd: '/workspace', parentSession: parent, isSeeded: false, origin: 'subagent', delegationDepth: 1,
})
/** A Session of its own whose event body carries the parent id as a JSON string value. */
const referenceLog = (): PersistedSessionLog => logOf('reference.jsonl', {
  type: 'session', version: 3, id: 'reference-session', createdAt: 3, cwd: '/workspace', isSeeded: false, delegationDepth: 0,
}, [{ type: 'team/member', data: { session: PARENT_ID } }])
const otherChildLog = (): PersistedSessionLog => childLog('other-child.jsonl', OTHER_CHILD_ID, OTHER_PARENT_ID)

/** All orderings of `items` (n!); selection must hold under every one of them. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()]
  const orders: T[][] = []
  for (let index = 0; index < items.length; index++) {
    const head = items[index]
    if (head === undefined) throw new Error('permutation builder received a sparse array')
    const rest = items.filter((_, position) => position !== index)
    for (const tail of permutations(rest)) orders.push([head, ...tail])
  }
  return orders
}

describe('session-log-identity selection', () => {
  it('selects the parent and its child under every enumeration order', () => {
    const parent = parentLog()
    const child = childLog()
    const orders = permutations([parent, child, referenceLog(), otherChildLog()])
    for (const order of orders) {
      const selectedParent = selectSessionLogById(order, PARENT_ID)
      expect(selectedParent.source, `order ${order.map(log => log.source).join(',')}`).toBe('parent.jsonl')
      expect(selectedParent.content).toBe(parent.content)
      const selectedChild = selectDirectSubagentChild(order, PARENT_ID)
      expect(selectedChild.source, `order ${order.map(log => log.source).join(',')}`).toBe('child.jsonl')
      expect(selectedChild.header.id).toBe(CHILD_ID)
    }
    expect(orders).toHaveLength(24)
  })

  it('rejects a parent id that only event bodies reference', () => {
    expect(() => selectSessionLogById([referenceLog()], PARENT_ID))
      .toThrow(/no persisted session log with id "fixture-parent"; found: reference\.jsonl/)
  })

  it('rejects duplicate parent logs by source', () => {
    const first = parentLog()
    const second = logOf('parent-copy.jsonl', {
      type: 'session', version: 3, id: PARENT_ID, createdAt: 1, cwd: '/workspace', isSeeded: false, delegationDepth: 0,
    }, [{ type: 'turn/start', seq: 0, time: 10, data: { turn: 1 } }])
    expect(() => selectSessionLogById([first, second], PARENT_ID))
      .toThrow(/duplicate persisted session logs with id "fixture-parent": parent\.jsonl, parent-copy\.jsonl/)
  })

  it('rejects an empty log set for both selectors', () => {
    expect(() => selectSessionLogById([], PARENT_ID)).toThrow(/no persisted session log with id "fixture-parent"; found: none/)
    expect(() => selectDirectSubagentChild([], PARENT_ID)).toThrow(/no direct subagent child of "fixture-parent"; found: none/)
  })

  it('rejects an unparsable first record by source, even beside a valid parent', () => {
    const corrupt: PersistedSessionLog = { source: 'corrupt.jsonl', content: 'not json at all\n' }
    expect(() => selectSessionLogById([corrupt, parentLog()], PARENT_ID))
      .toThrow(/session log corrupt\.jsonl: first record is not valid JSON/)
    expect(() => selectDirectSubagentChild([corrupt, parentLog()], PARENT_ID))
      .toThrow(/session log corrupt\.jsonl: first record is not valid JSON/)
  })

  it('rejects a first record that is not a session header', () => {
    const eventFirst: PersistedSessionLog = {
      source: 'event-first.jsonl',
      content: `${header({ type: 'turn/start', seq: 0, time: 10, data: { turn: 1 }, id: PARENT_ID })}\n`,
    }
    expect(() => selectSessionLogById([eventFirst], PARENT_ID))
      .toThrow(/session log event-first\.jsonl: first record type "turn\/start" is not 'session'/)
  })

  it('rejects a session header with no string id', () => {
    const idLess: PersistedSessionLog = {
      source: 'id-less.jsonl',
      content: `${header({ type: 'session', version: 3, createdAt: 1, isSeeded: false, delegationDepth: 0 })}\n`,
    }
    expect(() => selectSessionLogById([idLess], PARENT_ID)).toThrow(/session log id-less\.jsonl: session header has no string id/)
  })

  it('accepts header field order and CRLF line endings and returns the original bytes', () => {
    const content = `{"id":"${PARENT_ID}","delegationDepth":0,"isSeeded":false,"cwd":"/workspace","createdAt":1,"version":3,"type":"session"}\r\n${header({ type: 'turn/end', seq: 0, time: 10, data: { turn: 1, reason: { kind: 'completed' } } })}\r\n`
    const reordered: PersistedSessionLog = { source: 'parent.jsonl', content }
    const selected = selectSessionLogById([reordered, childLog()], PARENT_ID)
    expect(selected.content).toBe(content)
    expect(selected.header.id).toBe(PARENT_ID)
  })

  it('does not select another parent\'s child even when it enumerates first', () => {
    const selected = selectDirectSubagentChild([otherChildLog(), childLog()], PARENT_ID)
    expect(selected.source).toBe('child.jsonl')
    expect(selected.header.parentSession).toBe(PARENT_ID)
  })

  it('rejects zero direct subagent children', () => {
    expect(() => selectDirectSubagentChild([parentLog(), referenceLog()], PARENT_ID))
      .toThrow(/no direct subagent child of "fixture-parent"; found: parent\.jsonl.*reference\.jsonl/)
  })

  it('rejects sibling direct subagent children of one parent', () => {
    expect(() => selectDirectSubagentChild([parentLog(), childLog(), childLog('sibling.jsonl', 'fixture-sibling')], PARENT_ID))
      .toThrow(/duplicate direct subagent children of "fixture-parent": child\.jsonl, sibling\.jsonl/)
  })

  it('rejects a pinned child id that no direct child of the parent asserts', () => {
    expect(() => selectDirectSubagentChild([parentLog(), otherChildLog()], PARENT_ID, { childId: OTHER_CHILD_ID }))
      .toThrow(/no direct subagent child of "fixture-parent" with id "other-child"/)
  })

  it('does not select a grandchild as a direct child', () => {
    const grandchild = childLog('grandchild.jsonl', GRANDCHILD_ID, CHILD_ID)
    const withChild = selectDirectSubagentChild([parentLog(), childLog(), grandchild], PARENT_ID)
    expect(withChild.source).toBe('child.jsonl')
    expect(() => selectDirectSubagentChild([parentLog(), grandchild], PARENT_ID)).toThrow(/no direct subagent child of "fixture-parent"/)
  })

  it('requires the subagent origin on the child header', () => {
    const plainFork = logOf('fork.jsonl', {
      type: 'session', version: 3, id: 'plain-fork', createdAt: 2, cwd: '/workspace', parentSession: PARENT_ID, isSeeded: true, delegationDepth: 1,
    })
    expect(() => selectDirectSubagentChild([parentLog(), plainFork], PARENT_ID)).toThrow(/no direct subagent child of "fixture-parent"/)
  })

  it('leaves the input logs and their order unchanged', () => {
    const logs = [childLog(), referenceLog(), parentLog(), otherChildLog()]
    const before = logs.map(log => ({ ...log }))
    selectSessionLogById(logs, PARENT_ID)
    selectDirectSubagentChild(logs, PARENT_ID)
    expect(logs).toEqual(before)
  })
})
