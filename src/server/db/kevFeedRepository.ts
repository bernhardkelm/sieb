import type { DatabaseSync } from 'node:sqlite'

import { KEV_STALE_AFTER_MS, type KevFeedStatus } from '#core/kev.ts'

/** Stored outcome of the KEV feed fetches */
export interface KevFeedState {
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  catalogVersion: string | null
  dateReleased: string | null
  entryCount: number
}

interface KevFeedRow {
  last_attempt_at: string | null
  last_success_at: string | null
  last_error: string | null
  catalog_version: string | null
  date_released: string | null
  entry_count: number
}

/**
 * Reads the stored fetch state.
 * @param {DatabaseSync} db - Open database
 * @returns {KevFeedState} - Fetch state, all null before the first attempt
 */
export const readKevFeedState = (db: DatabaseSync): KevFeedState => {
  const row = db.prepare('SELECT * FROM kev_feed WHERE id = 1').get() as KevFeedRow | undefined

  return {
    lastAttemptAt: row?.last_attempt_at ?? null,
    lastSuccessAt: row?.last_success_at ?? null,
    lastError: row?.last_error ?? null,
    catalogVersion: row?.catalog_version ?? null,
    dateReleased: row?.date_released ?? null,
    entryCount: row?.entry_count ?? 0,
  }
}

/**
 * Records a successful fetch and clears the last error. Call it in the transaction that
 * replaces the catalog.
 * @param {DatabaseSync} db - Open database
 * @param {Pick<KevFeedState, 'catalogVersion' | 'dateReleased' | 'entryCount'>} feed - Stored catalog
 * @param {string} attemptAt - Start of the fetch
 * @param {string} at - Time the catalog was stored
 * @returns {void}
 */
export const recordKevSuccess = (
  db: DatabaseSync,
  feed: Pick<KevFeedState, 'catalogVersion' | 'dateReleased' | 'entryCount'>,
  attemptAt: string,
  at: string,
): void => {
  db.prepare(
    `UPDATE kev_feed SET last_attempt_at = ?, last_success_at = ?, last_error = NULL,
       catalog_version = ?, date_released = ?, entry_count = ?
     WHERE id = 1`,
  ).run(attemptAt, at, feed.catalogVersion, feed.dateReleased, feed.entryCount)
}

/**
 * Records a failed fetch, the stored catalog and its last success stay as they are.
 * @param {DatabaseSync} db - Open database
 * @param {string} error - Failure message
 * @param {string} attemptAt - Start of the fetch
 * @returns {void}
 */
export const recordKevFailure = (db: DatabaseSync, error: string, attemptAt: string): void => {
  db.prepare('UPDATE kev_feed SET last_attempt_at = ?, last_error = ? WHERE id = 1').run(
    attemptAt,
    error,
  )
}

/**
 * Returns whether the stored catalog is missing or its last successful fetch lies maxAgeMs back.
 * @param {Pick<KevFeedState, 'lastSuccessAt'>} state - Fetch state
 * @param {Date} now - Current time
 * @param {number} maxAgeMs - Age after which the catalog counts as old
 * @returns {boolean} - True when older than maxAgeMs or missing
 */
export const isKevCatalogOlderThan = (
  state: Pick<KevFeedState, 'lastSuccessAt'>,
  now: Date,
  maxAgeMs: number,
): boolean =>
  state.lastSuccessAt === null || now.getTime() - Date.parse(state.lastSuccessAt) >= maxAgeMs

/**
 * Reads the catalog health the sync status shows.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Current time
 * @returns {KevFeedStatus} - Health, stale when missing or older than KEV_STALE_AFTER_MS
 */
export const readKevFeedStatus = (db: DatabaseSync, now: Date): KevFeedStatus => {
  const state = readKevFeedState(db)

  return {
    lastAttemptAt: state.lastAttemptAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
    catalogVersion: state.catalogVersion,
    entryCount: state.entryCount,
    stale: isKevCatalogOlderThan(state, now, KEV_STALE_AFTER_MS),
  }
}
