import type { StatsResponse } from '#core/apiTypes.ts'
import type { StatsRange } from '#core/statsRange.ts'
import { apiRequest } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

export const STATS_URL = '/api/stats'

/**
 * Fetches the live overview stats and their history of one range.
 * @param {StatsRange} range - History range, the server defaults to 30d
 * @returns {Promise<StatsResponse>} - Current stats and at most 60 snapshots, oldest first
 * @throws {ApiError} - 400 for an unknown range
 */
export const fetchStats = (range?: StatsRange): Promise<StatsResponse> =>
  apiRequest(`${STATS_URL}${queryString({ range })}`)
