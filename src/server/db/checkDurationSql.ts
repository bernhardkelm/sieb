/**
 * SQL expression of how long an ended check ran, in ms: the duration the worker reported, else
 * the time between start and end, NULL for a check that never started. Mirrors durationOf in
 * checkRows.ts.
 */
export const CHECK_DURATION_MS_SQL = `COALESCE(duration_ms, CASE WHEN started_at IS NOT NULL
  THEN MAX(0, ROUND((julianday(finished_at) - julianday(started_at)) * 86400000)) END)`

/** Ended states whose duration counts, a cancelled check stopped before its end */
export const TIMED_CHECK_STATES_SQL = `('done', 'failed')`
