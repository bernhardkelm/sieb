import type { DatabaseSync } from 'node:sqlite'

import type { SyncCounts, SyncRun, SyncStatus } from '#core/syncRun.ts'
import type { SourceKind } from '#core/types.ts'

interface SyncRunRow {
  id: number
  source: string
  status: string
  started_at: string
  finished_at: string | null
  fetched_at: string | null
  error: string | null
  counts: string | null
}

/**
 * Maps a sync_runs row to the domain type.
 * @param {SyncRunRow} row - Row
 * @returns {SyncRun} - Sync run
 */
const toSyncRun = (row: SyncRunRow): SyncRun => ({
  id: row.id,
  source: row.source as SourceKind,
  status: row.status as SyncStatus,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  fetchedAt: row.fetched_at,
  error: row.error,
  counts: row.counts === null ? null : (JSON.parse(row.counts) as SyncCounts),
})

/**
 * Reads one sync run.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Run id
 * @returns {SyncRun} - Sync run
 * @throws {Error} - When the run does not exist
 */
const mustGetSyncRun = (db: DatabaseSync, id: number): SyncRun => {
  const row = db.prepare('SELECT * FROM sync_runs WHERE id = ?').get(id) as SyncRunRow | undefined

  if (!row) {
    throw new Error(`sync run ${id} vanished`)
  }

  return toSyncRun(row)
}

/**
 * Records the start of a sync run.
 * @param {DatabaseSync} db - Open database
 * @param {SourceKind} source - Data source
 * @param {Date} now - Start time
 * @returns {SyncRun} - Running sync run
 */
export const startSyncRun = (db: DatabaseSync, source: SourceKind, now: Date): SyncRun => {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO sync_runs (source, status, started_at) VALUES (?, 'running', ?)")
    .run(source, now.toISOString())

  return mustGetSyncRun(db, Number(lastInsertRowid))
}

/**
 * Records the successful end of a sync run.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Run id
 * @param {{ fetchedAt: string; counts: SyncCounts }} result - Snapshot time and counts
 * @param {Date} now - End time
 * @returns {SyncRun} - Finished sync run
 */
export const finishSyncRun = (
  db: DatabaseSync,
  id: number,
  result: { fetchedAt: string; counts: SyncCounts },
  now: Date,
): SyncRun => {
  db.prepare(
    "UPDATE sync_runs SET status = 'success', finished_at = ?, fetched_at = ?, counts = ? WHERE id = ?",
  ).run(now.toISOString(), result.fetchedAt, JSON.stringify(result.counts), id)

  return mustGetSyncRun(db, id)
}

/**
 * Records the failure of a sync run.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Run id
 * @param {string} error - Error message
 * @param {Date} now - End time
 * @returns {SyncRun} - Failed sync run
 */
export const failSyncRun = (db: DatabaseSync, id: number, error: string, now: Date): SyncRun => {
  db.prepare("UPDATE sync_runs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?").run(
    now.toISOString(),
    error,
    id,
  )

  return mustGetSyncRun(db, id)
}

/**
 * Marks runs left running by a previous process as failed.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {number} - Number of runs marked
 */
export const failInterruptedSyncRuns = (db: DatabaseSync, now: Date): number =>
  Number(
    db
      .prepare(
        "UPDATE sync_runs SET status = 'failed', finished_at = ?, error = 'interrupted' WHERE status = 'running'",
      )
      .run(now.toISOString()).changes,
  )

/**
 * Reads the latest sync run.
 * @param {DatabaseSync} db - Open database
 * @param {{ finished?: boolean }} filter - Only finished runs when finished is true
 * @returns {SyncRun | null} - Latest run, null before the first one
 */
export const latestSyncRun = (
  db: DatabaseSync,
  filter: { finished?: boolean } = {},
): SyncRun | null => {
  const where = filter.finished ? "WHERE status <> 'running'" : ''
  const row = db.prepare(`SELECT * FROM sync_runs ${where} ORDER BY id DESC LIMIT 1`).get() as
    | SyncRunRow
    | undefined

  return row ? toSyncRun(row) : null
}
