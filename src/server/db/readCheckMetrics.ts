import type { DatabaseSync } from 'node:sqlite'

import { ENDED_CHECK_STATES, OPEN_CHECK_STATES, type CheckMetrics } from '#core/checkMetricsText.ts'
import { CHECK_DURATION_MS_SQL, TIMED_CHECK_STATES_SQL } from '#server/db/checkDurationSql.ts'

/**
 * Counts the checks per state and sums the run time of the done and failed ones.
 * @param {DatabaseSync} db - Open database
 * @param {boolean | null} workerOnline - Worker presence, null while checks are off
 * @returns {CheckMetrics} - Check values of /metrics
 */
export const readCheckMetrics = (db: DatabaseSync, workerOnline: boolean | null): CheckMetrics => {
  const counts = new Map(
    (
      db.prepare('SELECT state, COUNT(*) AS n FROM checks GROUP BY state').all() as {
        state: string
        n: number
      }[]
    ).map((row) => [row.state, Number(row.n)]),
  )
  const duration = db
    .prepare(
      `SELECT COALESCE(SUM(d), 0) AS total, COUNT(d) AS n FROM (
         SELECT ${CHECK_DURATION_MS_SQL} AS d FROM checks
         WHERE state IN ${TIMED_CHECK_STATES_SQL})`,
    )
    .get() as { total: number; n: number }

  return {
    open: Object.fromEntries(
      OPEN_CHECK_STATES.map((state) => [state, counts.get(state) ?? 0]),
    ) as CheckMetrics['open'],
    finished: Object.fromEntries(
      ENDED_CHECK_STATES.map((state) => [state, counts.get(state) ?? 0]),
    ) as CheckMetrics['finished'],
    durationSecondsSum: Number(duration.total) / 1000,
    durationCount: Number(duration.n),
    workerOnline,
  }
}
