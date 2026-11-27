import { DAY_MS } from '#core/timeUnits.ts'

export const STATS_RANGE_DAYS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as const

export type StatsRange = keyof typeof STATS_RANGE_DAYS

export const STATS_RANGES = Object.keys(STATS_RANGE_DAYS) as StatsRange[]

/** Length of each range in words, for labels and screen readers */
export const STATS_RANGE_PERIODS: Readonly<Record<StatsRange, string>> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
}

export const DEFAULT_STATS_RANGE: StatsRange = '30d'

export const STATS_MAX_POINTS = 60

export const STATS_RETENTION_DAYS = 180

/**
 * Returns whether a value is a known stats range.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for 24h, 7d, 30d and 90d
 */
export const isStatsRange = (value: unknown): value is StatsRange =>
  typeof value === 'string' && Object.hasOwn(STATS_RANGE_DAYS, value)

/**
 * Returns the start of a range that ends now.
 * @param {StatsRange} range - Range
 * @param {Date} now - End of the range
 * @returns {Date} - Start of the range
 */
export const statsRangeStart = (range: StatsRange, now: Date): Date =>
  new Date(now.getTime() - STATS_RANGE_DAYS[range] * DAY_MS)
