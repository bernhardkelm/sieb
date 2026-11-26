import { describe, expect, it } from 'vitest'

import type { OverviewStats } from '#core/overviewStats.ts'
import { generateMockStatsHistory } from '#server/sources/mock/mockStatsHistory.ts'

const END = new Date('2026-06-01T12:00:00.000Z')
const CURRENT: OverviewStats = {
  open: 80,
  inbox: 30,
  kev: 2,
  public: 12,
  bySeverity: { critical: 6, high: 24, medium: 30, low: 15, unknown: 5 },
  notAffected: 14,
  accepted: 6,
  fixPlanned: 4,
  reopened: 1,
  activeDecisions: 12,
  images: 9,
}

describe('generateMockStatsHistory', () => {
  it('yields one point per 2h over 30 days, oldest first, ending one step before end', () => {
    const points = generateMockStatsHistory(CURRENT, END)
    const times = points.map((point) => Date.parse(point.at))

    expect(points).toHaveLength(360)
    expect(points[0]?.at).toBe('2026-05-02T12:00:00.000Z')
    expect(points.at(-1)?.at).toBe('2026-06-01T10:00:00.000Z')
    expect(
      times.slice(1).every((time, index) => time - (times[index] ?? 0) === 2 * 3_600_000),
    ).toBe(true)
  })

  it('is deterministic and converges to the current stats', () => {
    const points = generateMockStatsHistory(CURRENT, END)

    expect(generateMockStatsHistory(CURRENT, END)).toEqual(points)
    expect(points.at(-1)?.stats).toEqual(CURRENT)
  })

  it('trends from more open and untriaged findings to the current ones', () => {
    const points = generateMockStatsHistory(CURRENT, END)
    const first = points[0]?.stats

    expect(first?.open).toBeGreaterThan(CURRENT.open)
    expect(first?.inbox).toBeGreaterThan(CURRENT.inbox)
    expect(first?.activeDecisions).toBeLessThan(CURRENT.activeDecisions)
  })

  it('keeps every point internally consistent', () => {
    for (const { stats } of generateMockStatsHistory(CURRENT, END)) {
      const severities = Object.values(stats.bySeverity)

      expect(severities.reduce((total, count) => total + count, 0)).toBe(stats.open)
      expect(severities.every((count) => count >= 0)).toBe(true)
      expect(stats.inbox + (stats.notAffected ?? 0) + (stats.accepted ?? 0)).toBeLessThanOrEqual(
        stats.open,
      )
      expect(stats.kev).toBeLessThanOrEqual(stats.open)
      expect(stats.public).toBeLessThanOrEqual(stats.open)
      expect(stats.images).toBeLessThanOrEqual(stats.open)
    }
  })
})
