import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { KEV_REFRESH_AFTER_MS } from '#core/kev.ts'
import { isKevCatalogOlderThan, readKevFeedState } from '#server/db/kevFeedRepository.ts'
import type { KevRefresher } from '#server/kev/kevRefresher.ts'

export const KEV_CHECK_INTERVAL_MS = 15 * 60 * 1000
export const KEV_RETRY_AFTER_MS = 60 * 60 * 1000

export interface KevRefreshSchedule {
  stop: () => void
}

export interface KevRefreshScheduleOptions {
  db: DatabaseSync
  clock: Clock
  force?: boolean // refresh on start even when the stored catalog is fresh
  checkIntervalMs?: number
}

/**
 * Returns whether a scheduled check should fetch: the catalog is missing or older than
 * KEV_REFRESH_AFTER_MS and the last attempt lies KEV_RETRY_AFTER_MS back, so a failing feed is
 * retried hourly instead of on every check.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {boolean} - True when a refresh is due
 */
export const isKevRefreshDue = (db: DatabaseSync, now: Date): boolean => {
  const state = readKevFeedState(db)
  const retryDue =
    state.lastAttemptAt === null ||
    now.getTime() - Date.parse(state.lastAttemptAt) >= KEV_RETRY_AFTER_MS

  return retryDue && isKevCatalogOlderThan(state, now, KEV_REFRESH_AFTER_MS)
}

/**
 * Starts the KEV catalog refreshes without waiting for them: on start when forced or when the
 * stored catalog is missing or older than a day, a restart counting as a retry, then on every
 * check while a refresh is due. Refreshes never reject, so nothing escapes the timer.
 * @param {Pick<KevRefresher, 'refresh'>} refresher - Refresher
 * @param {KevRefreshScheduleOptions} options - Database, clock, force and check interval
 * @returns {KevRefreshSchedule} - Handle to stop the timer
 */
export const startKevRefreshSchedule = (
  refresher: Pick<KevRefresher, 'refresh'>,
  { db, clock, force = false, checkIntervalMs = KEV_CHECK_INTERVAL_MS }: KevRefreshScheduleOptions,
): KevRefreshSchedule => {
  if (force || isKevCatalogOlderThan(readKevFeedState(db), clock(), KEV_REFRESH_AFTER_MS)) {
    void refresher.refresh()
  }

  const timer = setInterval(() => {
    if (isKevRefreshDue(db, clock())) {
      void refresher.refresh()
    }
  }, checkIntervalMs)

  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
