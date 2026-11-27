import type { DatabaseSync } from 'node:sqlite'

import type { CheckUsageSummary, CheckUsageWindow } from '#core/check.ts'
import { CHECK_USAGE_WINDOW_DAYS } from '#core/checkLimits.ts'
import { CHECK_DURATION_MS_SQL, TIMED_CHECK_STATES_SQL } from '#server/db/checkDurationSql.ts'
import { DAY_MS } from '#core/timeUnits.ts'

interface UsageRow {
  checks: number
  with_usage: number
  input_tokens: number
  output_tokens: number
  cache_tokens: number
  cost_usd: number | null
  average_duration_ms: number | null
}

/**
 * Sums the Claude usage of the checks of all users that ended within the last days: their
 * count, the tokens and API-equivalent cost estimates the workers reported and the average
 * duration of the done and failed ones.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @param {number} days - Window length in days
 * @returns {CheckUsageWindow} - Window summary
 */
export const readCheckUsageWindow = (
  db: DatabaseSync,
  now: Date,
  days: number,
): CheckUsageWindow => {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS checks,
         COUNT(usage) AS with_usage,
         COALESCE(SUM(json_extract(usage, '$.inputTokens')), 0) AS input_tokens,
         COALESCE(SUM(json_extract(usage, '$.outputTokens')), 0) AS output_tokens,
         COALESCE(SUM(json_extract(usage, '$.cacheReadTokens')
           + json_extract(usage, '$.cacheCreationTokens')), 0) AS cache_tokens,
         SUM(json_extract(usage, '$.costUsd')) AS cost_usd,
         AVG(CASE WHEN state IN ${TIMED_CHECK_STATES_SQL} THEN ${CHECK_DURATION_MS_SQL} END)
           AS average_duration_ms
       FROM checks WHERE finished_at IS NOT NULL AND finished_at >= ?`,
    )
    .get(new Date(now.getTime() - days * DAY_MS).toISOString()) as unknown as UsageRow

  return {
    days,
    checks: Number(row.checks),
    withUsage: Number(row.with_usage),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    cacheTokens: Number(row.cache_tokens),
    costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
    averageDurationMs:
      row.average_duration_ms === null ? null : Math.round(Number(row.average_duration_ms)),
  }
}

/**
 * Reads the usage summary of the last 7 and 30 days.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {CheckUsageSummary} - Both windows
 */
export const readCheckUsageSummary = (db: DatabaseSync, now: Date): CheckUsageSummary => ({
  last7Days: readCheckUsageWindow(db, now, CHECK_USAGE_WINDOW_DAYS.last7Days),
  last30Days: readCheckUsageWindow(db, now, CHECK_USAGE_WINDOW_DAYS.last30Days),
})
