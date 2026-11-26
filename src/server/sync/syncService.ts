import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import type { SyncRun } from '#core/syncRun.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import {
  failInterruptedSyncRuns,
  failSyncRun,
  finishSyncRun,
  latestSyncRun,
  startSyncRun,
} from '#server/db/syncRunRepository.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'
import { recordDecisionTransitions } from '#server/sync/recordDecisionTransitions.ts'
import { recordStatsSnapshot } from '#server/sync/recordStatsSnapshot.ts'

export interface SyncService {
  syncNow: () => Promise<SyncRun> // resolves with the finished run, failed runs included, rejects only when the run cannot be recorded
  latestRun: () => SyncRun | null
  isRunning: () => boolean
}

export interface SyncServiceDeps {
  db: DatabaseSync
  source: FindingSource
  clock: Clock
  log?: (message: string) => void
}

/**
 * Returns the message of a thrown value.
 * @param {unknown} error - Thrown value
 * @returns {string} - Message
 */
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Creates the sync service. A sync fetches the source, then writes the snapshot, the decision
 * transitions, the overview stats and the success of the run in one transaction, so a run is
 * recorded as successful exactly when its snapshot was committed. A failing fetch or write rolls
 * back, is recorded as failed and resolves nothing. When even the run cannot be recorded, syncNow rejects after
 * logging. A call during a running sync returns that sync. Runs left running by a crashed
 * process are marked failed on creation.
 * @param {SyncServiceDeps} deps - Database, source, clock, logger
 * @returns {SyncService} - Service
 */
export const createSyncService = ({
  db,
  source,
  clock,
  log = console.error,
}: SyncServiceDeps): SyncService => {
  let running: Promise<SyncRun> | null = null

  failInterruptedSyncRuns(db, clock())

  /**
   * Fetches and commits one snapshot for a started run.
   * @param {SyncRun} started - Running sync run
   * @returns {Promise<SyncRun>} - Finished run
   */
  const commit = async (started: SyncRun): Promise<SyncRun> => {
    const snapshot = await source.fetchSnapshot()
    const now = clock()

    const { counts, finished } = inTransaction(db, () => {
      const written = {
        ...applySnapshot(db, snapshot, now),
        decisionEvents: recordDecisionTransitions(db, now),
      }

      recordStatsSnapshot(db, started.id, now)

      return {
        counts: written,
        finished: finishSyncRun(
          db,
          started.id,
          { fetchedAt: snapshot.fetchedAt, counts: written },
          clock(),
        ),
      }
    })

    log(
      `[sieb] sync ${started.id} from ${source.kind}: ${counts.findingsSeen} findings, ` +
        `${counts.findingsNew} new, ${counts.findingsResolved} resolved, ` +
        `${counts.findingsReappeared} reappeared`,
    )
    return finished
  }

  /**
   * Runs one sync and records its outcome.
   * @returns {Promise<SyncRun>} - Finished run, failed runs included
   * @throws {Error} - When the run cannot be recorded at all
   */
  const run = async (): Promise<SyncRun> => {
    let started: SyncRun

    try {
      started = startSyncRun(db, source.kind, clock())
    } catch (error) {
      log(`[sieb] sync from ${source.kind} could not start: ${messageOf(error)}`)
      throw error
    }

    try {
      return await commit(started)
    } catch (error) {
      log(`[sieb] sync ${started.id} from ${source.kind} failed: ${messageOf(error)}`)

      try {
        return failSyncRun(db, started.id, messageOf(error), clock())
      } catch (recordError) {
        log(`[sieb] sync ${started.id} failure not recorded: ${messageOf(recordError)}`)
        throw recordError
      }
    }
  }

  return {
    syncNow: () => {
      running ??= run().finally(() => {
        running = null
      })
      return running
    },
    latestRun: () => latestSyncRun(db),
    isRunning: () => running !== null,
  }
}
