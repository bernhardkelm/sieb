import { describe, expect, it } from 'vitest'

import { moveCursor, reconcileCursor, toggleId } from '@/keyboard/listNavigation'

describe('moveCursor', () => {
  it('moves by one and stops at both ends', () => {
    expect(moveCursor([1, 2, 3], 1, 1)).toBe(2)
    expect(moveCursor([1, 2, 3], 3, 1)).toBe(3)
    expect(moveCursor([1, 2, 3], 1, -1)).toBe(1)
  })

  it('starts at the first row going down and the last going up', () => {
    expect(moveCursor([1, 2, 3], null, 1)).toBe(1)
    expect(moveCursor([1, 2, 3], null, -1)).toBe(3)
    expect(moveCursor([1, 2, 3], 9, 1)).toBe(1)
  })

  it('has no cursor in an empty list', () => {
    expect(moveCursor([], 1, 1)).toBeNull()
  })
})

describe('reconcileCursor', () => {
  it('keeps a cursor that is still listed', () => {
    expect(reconcileCursor([1, 2, 3], [3, 2], 2)).toBe(2)
  })

  it('hands the cursor to the next remaining row when its row left', () => {
    expect(reconcileCursor([1, 2, 3, 4], [1, 4], 2)).toBe(4)
  })

  it('falls back to the previous row at the end of the list', () => {
    expect(reconcileCursor([1, 2, 3], [1, 2], 3)).toBe(2)
  })

  it('clears the cursor when nothing is left', () => {
    expect(reconcileCursor([1], [], 1)).toBeNull()
  })

  it('takes the first row for a cursor that was never listed', () => {
    expect(reconcileCursor([1, 2], [5, 6], 9)).toBe(5)
  })
})

describe('toggleId', () => {
  it('adds and removes without touching the input set', () => {
    const checked = new Set([1])

    expect([...toggleId(checked, 2)]).toEqual([1, 2])
    expect([...toggleId(checked, 1)]).toEqual([])
    expect([...checked]).toEqual([1])
  })
})
