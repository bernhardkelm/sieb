import type { StatsResponse } from '#core/apiTypes.ts'
import { emptyOverviewStats, type OverviewStats, type RecordedStats } from '#core/overviewStats.ts'

/**
 * Builds overview stats, zero except the given counts.
 * @param {Partial<OverviewStats>} overrides - Counts to set
 * @returns {OverviewStats} - Stats
 */
export const buildStats = (overrides: Partial<OverviewStats> = {}): OverviewStats => ({
  ...emptyOverviewStats(),
  ...overrides,
})

/**
 * Builds a stats answer from the live counts and a history of snapshots.
 * @param {Partial<OverviewStats>} current - Live counts
 * @param {readonly [string, Partial<RecordedStats>][]} series - Timestamp and counts per snapshot, oldest first
 * @returns {StatsResponse} - Answer
 */
export const buildStatsResponse = (
  current: Partial<OverviewStats>,
  series: readonly [string, Partial<RecordedStats>][] = [],
): StatsResponse => ({
  current: buildStats(current),
  series: series.map(([at, stats]) => ({ at, stats: { ...emptyOverviewStats(), ...stats } })),
})
