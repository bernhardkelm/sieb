import type { DatabaseSync } from 'node:sqlite'

import { emptyOverviewStats, type RecordedStats, type StatsPoint } from '#core/overviewStats.ts'

interface StatsSnapshotRow {
  taken_at: string
  stats: string
}

/**
 * Parses stored stats, counts added after the snapshot was written read as zero. The verdict
 * counts read as null instead, older snapshots only hold their sum as suppressed, which is dropped.
 * @param {string} json - Stored stats
 * @returns {RecordedStats} - Stats
 */
const parseStats = (json: string): RecordedStats => {
  const empty = emptyOverviewStats()
  const stored = JSON.parse(json) as Partial<RecordedStats> & { suppressed?: number }

  delete stored.suppressed

  return {
    ...empty,
    notAffected: null,
    accepted: null,
    ...stored,
    bySeverity: { ...empty.bySeverity, ...stored.bySeverity },
  }
}

/**
 * Stores overview stats taken at a time.
 * @param {DatabaseSync} db - Open database
 * @param {StatsPoint} point - Stats with their time
 * @param {number | null} syncRunId - Sync run that took them, null for synthetic history
 * @returns {void}
 */
export const insertStatsSnapshot = (
  db: DatabaseSync,
  point: StatsPoint,
  syncRunId: number | null,
): void => {
  db.prepare('INSERT INTO stats_snapshots (sync_run_id, taken_at, stats) VALUES (?, ?, ?)').run(
    syncRunId,
    point.at,
    JSON.stringify(point.stats),
  )
}

/**
 * Lists the snapshots taken at or after a time.
 * @param {DatabaseSync} db - Open database
 * @param {Date} since - Earliest time
 * @returns {StatsPoint[]} - Snapshots, oldest first
 */
export const listStatsSnapshots = (db: DatabaseSync, since: Date): StatsPoint[] =>
  (
    db
      .prepare(
        'SELECT taken_at, stats FROM stats_snapshots WHERE taken_at >= ? ORDER BY taken_at, id',
      )
      .all(since.toISOString()) as unknown as StatsSnapshotRow[]
  ).map((row) => ({ at: row.taken_at, stats: parseStats(row.stats) }))

/**
 * Deletes the snapshots taken before a time.
 * @param {DatabaseSync} db - Open database
 * @param {Date} before - Cutoff
 * @returns {number} - Snapshots deleted
 */
export const deleteStatsSnapshotsBefore = (db: DatabaseSync, before: Date): number =>
  Number(
    db.prepare('DELETE FROM stats_snapshots WHERE taken_at < ?').run(before.toISOString()).changes,
  )

/**
 * Reads the time of the oldest snapshot.
 * @param {DatabaseSync} db - Open database
 * @returns {string | null} - ISO time, null without snapshots
 */
export const oldestStatsSnapshotAt = (db: DatabaseSync): string | null => {
  const row = db.prepare('SELECT MIN(taken_at) AS at FROM stats_snapshots').get()

  return typeof row?.at === 'string' ? row.at : null
}
