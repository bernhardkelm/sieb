import { describe, expect, it } from 'vitest'

import { compareSortValues, sortItems, type SortColumns } from '@/components/list/listSort'
import { ariaSort, describeSort, nextSort, parseSort } from '@/components/list/sortState'

interface Item {
  id: string
  count: number
  name: string | null
}

type Column = 'count' | 'name'

const COLUMNS: SortColumns<Item, Column> = {
  count: { label: 'Count', first: 'desc', value: (item) => item.count },
  name: { label: 'Name', first: 'asc', value: (item) => item.name },
}

const ITEMS: Item[] = [
  { id: 'a', count: 2, name: 'beta' },
  { id: 'b', count: 5, name: null },
  { id: 'c', count: 2, name: 'Alpha' },
  { id: 'd', count: 1, name: 'gamma' },
]

/**
 * Returns the ids of items in order.
 * @param {readonly Item[]} items - Items
 * @returns {string[]} - Ids
 */
const ids = (items: readonly Item[]): string[] => items.map((item) => item.id)

describe('compareSortValues', () => {
  it('compares numbers, strings naturally and tuples element by element', () => {
    expect(compareSortValues(1, 2)).toBeLessThan(0)
    expect(compareSortValues('CVE-2024-999', 'CVE-2024-1000')).toBeLessThan(0)
    expect(compareSortValues('alpha', 'Alpha')).toBe(0)
    expect(compareSortValues([1, 5], [1, 3])).toBeGreaterThan(0)
    expect(compareSortValues([0, 9], [1, 0])).toBeLessThan(0)
  })
})

describe('sortItems', () => {
  it('keeps the order without a sort and never mutates the input', () => {
    const input = [...ITEMS]

    expect(ids(sortItems(input, COLUMNS, null))).toEqual(['a', 'b', 'c', 'd'])
    sortItems(input, COLUMNS, { column: 'count', direction: 'asc' })
    expect(input).toEqual(ITEMS)
  })

  it('sorts stably in both directions, ties keep the given order', () => {
    expect(ids(sortItems(ITEMS, COLUMNS, { column: 'count', direction: 'desc' }))).toEqual([
      'b',
      'a',
      'c',
      'd',
    ])
    expect(ids(sortItems(ITEMS, COLUMNS, { column: 'count', direction: 'asc' }))).toEqual([
      'd',
      'a',
      'c',
      'b',
    ])
  })

  it('puts nulls last in both directions', () => {
    expect(ids(sortItems(ITEMS, COLUMNS, { column: 'name', direction: 'asc' }))).toEqual([
      'c',
      'a',
      'd',
      'b',
    ])
    expect(ids(sortItems(ITEMS, COLUMNS, { column: 'name', direction: 'desc' }))).toEqual([
      'd',
      'a',
      'c',
      'b',
    ])
  })

  it('breaks ties with the fallback order', () => {
    const byIdDescending = (a: Item, b: Item): number => b.id.localeCompare(a.id)

    expect(
      ids(sortItems(ITEMS, COLUMNS, { column: 'count', direction: 'desc' }, byIdDescending)),
    ).toEqual(['b', 'c', 'a', 'd'])
  })
})

describe('nextSort', () => {
  it('cycles a column through its first direction, the opposite and the default order', () => {
    const first = nextSort<Column>(null, 'count', 'desc')
    const second = nextSort(first, 'count', 'desc')

    expect(first).toEqual({ column: 'count', direction: 'desc' })
    expect(second).toEqual({ column: 'count', direction: 'asc' })
    expect(nextSort(second, 'count', 'desc')).toBeNull()
  })

  it('starts another column in its own first direction', () => {
    expect(nextSort<Column>({ column: 'count', direction: 'asc' }, 'name', 'asc')).toEqual({
      column: 'name',
      direction: 'asc',
    })
  })
})

describe('parseSort', () => {
  it('reads a known column and direction', () => {
    expect(parseSort(COLUMNS, 'name', 'desc')).toEqual({ column: 'name', direction: 'desc' })
  })

  it('uses the first direction of a known column without a direction', () => {
    expect(parseSort(COLUMNS, 'count', null)).toEqual({ column: 'count', direction: 'desc' })
  })

  it('falls back to the default order for unknown values', () => {
    expect(parseSort(COLUMNS, null, 'asc')).toBeNull()
    expect(parseSort(COLUMNS, 'size', 'asc')).toBeNull()
    expect(parseSort(COLUMNS, 'toString', 'asc')).toBeNull()
    expect(parseSort(COLUMNS, 'count', 'up')).toBeNull()
  })
})

describe('ariaSort and describeSort', () => {
  it('names the direction of the sorted column only', () => {
    const sort = { column: 'count', direction: 'asc' } as const

    expect(ariaSort<Column>(sort, 'count')).toBe('ascending')
    expect(ariaSort<Column>({ ...sort, direction: 'desc' }, 'count')).toBe('descending')
    expect(ariaSort<Column>(sort, 'name')).toBeUndefined()
    expect(describeSort(COLUMNS, sort)).toBe('Count, ascending')
    expect(describeSort(COLUMNS, null)).toBeNull()
  })
})
