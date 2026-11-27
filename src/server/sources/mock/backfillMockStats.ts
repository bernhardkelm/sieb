import type { DatabaseSync } from 'node:sqlite'

import type { SourceKind } from '#core/types.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import { readOverviewStats } from '#server/db/readOverviewStats.ts'
import { insertStatsSnapshot, oldestStatsSnapshotAt } from '#server/db/statsSnapshotRepository.ts'
import { generateMockStatsHistory } from '#server/sources/mock/mockStatsHistory.ts'
import { DAY_MS } from '#core/timeUnits.ts'

/**
 * Seeds synthetic stats history in mock mode when no snapshot is older than a day. The history
 * ends before the oldest snapshot and converges to the current stats. Other sources are never
 * touched.
 * @param {DatabaseSync} db - Open database
 * @param {SourceKind} source - Configured data source
 * @param {Date} now - Current time
 * @returns {number} - Snapshots written
 */
export const backfillMockStats = (db: DatabaseSync, source: SourceKind, now: Date): number => {
  if (source !== 'mock') {
    return 0
  }

  const oldest = oldestStatsSnapshotAt(db)
  const oldestTime = oldest === null ? now.getTime() : Math.min(Date.parse(oldest), now.getTime())

  if (oldestTime < now.getTime() - DAY_MS) {
    return 0
  }

  const points = generateMockStatsHistory(readOverviewStats(db, now), new Date(oldestTime))

  inTransaction(db, () => {
    for (const point of points) {
      insertStatsSnapshot(db, point, null)
    }
  })

  return points.length
}
