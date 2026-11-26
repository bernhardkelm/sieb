import { findingIdOfRowKey, groupOfRowKey } from '@/keyboard/rowKey'

export type TreeMove =
  | { kind: 'expand'; group: string }
  | { kind: 'collapse' }
  | { kind: 'enter' }
  | { kind: 'focus'; key: string }

/**
 * Returns what ArrowRight and ArrowLeft do in a list of group rows with nested finding rows,
 * as in a tree view: right expands a collapsed group and steps into an expanded one, left
 * collapses an expanded group and steps from a nested row up to its group row.
 * @param {readonly string[]} keys - Row keys in display order
 * @param {string | null} currentKey - Cursor row
 * @param {string | null} expanded - Expanded group, null when none is
 * @param {'in' | 'out'} direction - In for ArrowRight, out for ArrowLeft
 * @returns {TreeMove | null} - Move, null when the key does nothing on the row
 */
export const treeMoveFor = (
  keys: readonly string[],
  currentKey: string | null,
  expanded: string | null,
  direction: 'in' | 'out',
): TreeMove | null => {
  const group = groupOfRowKey(currentKey)

  if (group !== null) {
    if (direction === 'out') {
      return group === expanded ? { kind: 'collapse' } : null
    }

    if (group !== expanded) {
      return { kind: 'expand', group }
    }

    const next = keys[keys.indexOf(currentKey!) + 1]

    return findingIdOfRowKey(next ?? null) === null ? null : { kind: 'enter' }
  }

  if (direction === 'in' || currentKey === null) {
    return null
  }

  const parent = keys
    .slice(0, keys.indexOf(currentKey))
    .reverse()
    .find((key) => groupOfRowKey(key) !== null)

  return parent === undefined ? null : { kind: 'focus', key: parent }
}
