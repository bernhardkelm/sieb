import { describe, expect, it } from 'vitest'

import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { treeMoveFor } from '@/keyboard/treeNavigation'

const KEYS = [groupRowKey('a'), findingRowKey(1), findingRowKey(2), groupRowKey('b')]

describe('treeMoveFor', () => {
  it('expands a collapsed group and steps into an expanded one', () => {
    expect(treeMoveFor(KEYS, groupRowKey('b'), 'a', 'in')).toEqual({ kind: 'expand', group: 'b' })
    expect(treeMoveFor(KEYS, groupRowKey('a'), 'a', 'in')).toEqual({ kind: 'enter' })
  })

  it('does nothing stepping into an expanded group without nested rows', () => {
    expect(treeMoveFor([groupRowKey('a'), groupRowKey('b')], groupRowKey('a'), 'a', 'in')).toBe(
      null,
    )
  })

  it('collapses the expanded group and leaves collapsed ones alone', () => {
    expect(treeMoveFor(KEYS, groupRowKey('a'), 'a', 'out')).toEqual({ kind: 'collapse' })
    expect(treeMoveFor(KEYS, groupRowKey('b'), 'a', 'out')).toBeNull()
  })

  it('steps from a nested row up to its group row', () => {
    expect(treeMoveFor(KEYS, findingRowKey(2), 'a', 'out')).toEqual({
      kind: 'focus',
      key: groupRowKey('a'),
    })
    expect(treeMoveFor(KEYS, findingRowKey(2), 'a', 'in')).toBeNull()
  })
})
