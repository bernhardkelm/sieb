import type { DatabaseSync } from 'node:sqlite'

import { computeOverviewStats, type OverviewStats } from '#core/overviewStats.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import { listOpenFindings } from '#server/db/findingRepository.ts'

/**
 * Computes the overview stats of the stored findings and decisions.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {OverviewStats} - Stats
 */
export const readOverviewStats = (db: DatabaseSync, now: Date): OverviewStats =>
  computeOverviewStats(listOpenFindings(db), listDecisions(db), now)
