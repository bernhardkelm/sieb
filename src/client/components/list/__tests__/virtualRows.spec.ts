import { describe, expect, it } from 'vitest'

import { indexByKey, rowAria, withPinned } from '@/components/list/virtualRows'

describe('withPinned', () => {
  it('adds pinned rows outside the range in ascending order', () => {
    expect(withPinned([10, 11, 12], [1500, 3])).toEqual([3, 10, 11, 12, 1500])
  })

  it('keeps the range as it is when the pinned rows are inside it or not listed', () => {
    expect(withPinned([10, 11, 12], [11, undefined])).toEqual([10, 11, 12])
  })

  it('does not duplicate a row pinned twice', () => {
    expect(withPinned([0, 1], [5, 5])).toEqual([0, 1, 5])
  })
})

describe('rowAria', () => {
  it('announces position and size of the full list for listbox options', () => {
    expect(rowAria('listbox', 0, 2000, 0)).toEqual({ 'aria-setsize': 2000, 'aria-posinset': 1 })
    expect(rowAria('listbox', 1999, 2000, 0)).toEqual({
      'aria-setsize': 2000,
      'aria-posinset': 2000,
    })
  })

  it('counts the header row into the row index of treegrid rows', () => {
    expect(rowAria('treegrid', 0, 50, 1)).toEqual({ 'aria-rowindex': 2 })
    expect(rowAria('treegrid', 49, 50, 1)).toEqual({ 'aria-rowindex': 51 })
  })
})

describe('indexByKey', () => {
  it('maps each row key to its index', () => {
    const lookup = indexByKey([{ id: 4 }, { id: 9 }], (row) => row.id)

    expect(lookup.get(9)).toBe(1)
    expect(lookup.get(5)).toBeUndefined()
  })
})
