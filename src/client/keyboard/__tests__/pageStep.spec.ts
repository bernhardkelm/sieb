import { describe, expect, it } from 'vitest'

import { pageStepFor, pageStepOfRows } from '@/keyboard/pageStep'

/**
 * Builds measured rows of one height from the top of the page.
 * @param {number} count - Rows
 * @param {number} height - Height of a row in px
 * @returns {{ start: number, end: number }[]} - Rows
 */
const rows = (count: number, height: number): { start: number; end: number }[] =>
  Array.from({ length: count }, (_, index) => ({
    start: index * height,
    end: (index + 1) * height,
  }))

describe('pageStepFor', () => {
  it('fits one viewport of rows less one, a fixed step without measurements', () => {
    expect(pageStepFor(768, 32)).toBe(23)
    expect(pageStepFor(0, 32)).toBe(10)
  })
})

describe('pageStepOfRows', () => {
  it('counts the rows fully inside the visible area, less one', () => {
    expect(pageStepOfRows(rows(40, 32), 0, 768)).toBe(23)
  })

  it('leaves out rows cut by an edge of the visible area', () => {
    expect(pageStepOfRows(rows(40, 32), 16, 784)).toBe(22)
  })

  it('follows rows of mixed height, as wrapped rows on narrow screens', () => {
    const mixed = [
      ...rows(4, 32),
      ...rows(4, 64).map((row) => ({ start: row.start + 128, end: row.end + 128 })),
    ]

    expect(pageStepOfRows(mixed, 0, 256)).toBe(5)
  })

  it('moves at least one row and falls back to a fixed step without visible rows', () => {
    expect(pageStepOfRows(rows(1, 32), 0, 768)).toBe(1)
    expect(pageStepOfRows([], 0, 768)).toBe(10)
  })
})
