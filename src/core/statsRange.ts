export const STATS_RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const

export type StatsRange = keyof typeof STATS_RANGE_DAYS

export const STATS_RANGES = Object.keys(STATS_RANGE_DAYS) as StatsRange[]

export const DEFAULT_STATS_RANGE: StatsRange = '30d'

export const STATS_MAX_POINTS = 60

export const STATS_RETENTION_DAYS = 180

export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Returns whether a value is a known stats range.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for 7d, 30d and 90d
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
