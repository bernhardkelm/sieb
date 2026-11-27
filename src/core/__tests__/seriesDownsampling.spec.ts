import { describe, expect, it } from 'vitest'

import { downsampleLatest } from '#core/seriesDownsampling.ts'
import { HOUR_MS } from '#core/timeUnits.ts'

const FROM = new Date('2026-06-01T00:00:00.000Z')
const TO = new Date('2026-06-02T00:00:00.000Z')

/**
 * Builds a point at an hour offset from FROM.
 * @param {number} hours - Hours after FROM
 * @returns {{ at: string; hours: number }} - Point
 */
const pointAt = (hours: number): { at: string; hours: number } => ({
  at: new Date(FROM.getTime() + hours * HOUR_MS).toISOString(),
  hours,
})

describe('downsampleLatest', () => {
  it('keeps the latest point of each bucket, oldest first', () => {
    const points = [0, 1, 2.5, 5, 7.9, 23.5].map(pointAt)
    const result = downsampleLatest(points, { from: FROM, to: TO }, 3)

    expect(result.map((point) => point.hours)).toEqual([7.9, 23.5])
  })

  it('caps a dense series at maxPoints', () => {
    const points = Array.from({ length: 24 * 12 }, (_, index) => pointAt(index / 12))
    const result = downsampleLatest(points, { from: FROM, to: TO }, 60)

    expect(result).toHaveLength(60)
    expect(result.at(-1)?.hours).toBe(points.at(-1)?.hours)
    expect(result.map((point) => point.at)).toEqual(result.map((point) => point.at).sort())
  })

  it('keeps sparse series untouched and ignores input order', () => {
    const points = [pointAt(12), pointAt(3)]

    expect(downsampleLatest(points, { from: FROM, to: TO }, 60)).toEqual([pointAt(3), pointAt(12)])
  })

  it('drops points before the window and puts later ones in the last bucket', () => {
    const points = [pointAt(-1), pointAt(23.9), pointAt(25)]

    expect(downsampleLatest(points, { from: FROM, to: TO }, 4)).toEqual([pointAt(25)])
  })
})
