import { describe, expect, it } from 'vitest'

import { rangeBetween, withRange } from '@/keyboard/listRange'
import { stepCursor } from '@/keyboard/listNavigation'
import { pageStepFor } from '@/keyboard/pageStep'

describe('rangeBetween', () => {
  it('returns the rows between both ends in display order, either direction', () => {
    expect(rangeBetween([1, 2, 3, 4], 2, 4)).toEqual([2, 3, 4])
    expect(rangeBetween([1, 2, 3, 4], 4, 2)).toEqual([2, 3, 4])
    expect(rangeBetween([1, 2, 3, 4], 3, 3)).toEqual([3])
  })

  it('falls back to the head without a listed anchor and to nothing without a listed head', () => {
    expect(rangeBetween([1, 2, 3], 9, 2)).toEqual([2])
    expect(rangeBetween([1, 2, 3], 1, 9)).toEqual([])
  })
})

describe('withRange', () => {
  it('adds the range to the rows checked before and drops rows no longer listed', () => {
    expect([...withRange([1, 2, 3, 4, 5], new Set([5, 9]), 2, 3)]).toEqual([5, 2, 3])
  })

  it('shrinks back to the anchor when the head returns', () => {
    expect([...withRange([1, 2, 3, 4], new Set<number>(), 2, 2)]).toEqual([2])
  })
})

describe('stepCursor', () => {
  it('jumps to the ends and steps by rows', () => {
    expect(stepCursor([1, 2, 3], 2, 'first')).toBe(1)
    expect(stepCursor([1, 2, 3], null, 'last')).toBe(3)
    expect(stepCursor([1, 2, 3], 1, 10)).toBe(3)
    expect(stepCursor([], null, 'first')).toBeNull()
  })
})

describe('pageStepFor', () => {
  it('moves a viewport of rows less one, at least one row', () => {
    expect(pageStepFor(800, 40)).toBe(19)
    expect(pageStepFor(30, 40)).toBe(1)
  })

  it('falls back to a fixed step when nothing is measured', () => {
    expect(pageStepFor(0, 40)).toBe(10)
    expect(pageStepFor(800, 0)).toBe(10)
  })
})
