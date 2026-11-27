import type { DatabaseSync } from 'node:sqlite'

import { STATS_RETENTION_DAYS } from '#core/statsRange.ts'
import { readOverviewStats } from '#server/db/readOverviewStats.ts'
import {
  deleteStatsSnapshotsBefore,
  insertStatsSnapshot,
} from '#server/db/statsSnapshotRepository.ts'
import { DAY_MS } from '#core/timeUnits.ts'

/**
 * Stores the overview stats after a sync and deletes snapshots older than the retention. Call it
 * inside the transaction that commits the sync, after its decision transitions.
 * @param {DatabaseSync} db - Open database
 * @param {number} syncRunId - Committing sync run
 * @param {Date} now - Time of the sync
 * @returns {void}
 */
export const recordStatsSnapshot = (db: DatabaseSync, syncRunId: number, now: Date): void => {
  insertStatsSnapshot(db, { at: now.toISOString(), stats: readOverviewStats(db, now) }, syncRunId)
  deleteStatsSnapshotsBefore(db, new Date(now.getTime() - STATS_RETENTION_DAYS * DAY_MS))
}
