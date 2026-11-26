import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import { countKevEntries, replaceKevCatalog } from '#server/db/kevCatalogRepository.ts'
import {
  readKevFeedState,
  recordKevFailure,
  recordKevSuccess,
} from '#server/db/kevFeedRepository.ts'
import type { KevFeed } from '#server/kev/parseKevFeed.ts'

/** Share of the stored entries a new feed must keep, a smaller feed counts as truncated */
export const MIN_RETAINED_SHARE = 0.5

export interface KevRefresher {
  refresh: () => Promise<boolean> // true when the catalog was replaced, never rejects
}

export interface KevRefresherDeps {
  db: DatabaseSync
  loadFeed: () => Promise<KevFeed> // downloads and validates the feed
  clock: Clock
  log?: (message: string) => void
  onUpdated?: () => void // called after a new catalog was stored
}

/**
 * Returns the message of a thrown value.
 * @param {unknown} error - Thrown value
 * @returns {string} - Message
 */
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Rejects a feed that lost too many entries against the stored catalog.
 * @param {KevFeed} feed - Validated feed
 * @param {number} stored - Stored entries
 * @returns {void}
 * @throws {Error} - When the feed keeps less than MIN_RETAINED_SHARE of the stored entries
 */
const assertNotTruncated = (feed: KevFeed, stored: number): void => {
  if (feed.entries.length < stored * MIN_RETAINED_SHARE) {
    throw new Error(
      `KEV feed lists ${feed.entries.length} entries against ${stored} stored, looks truncated`,
    )
  }
}

/**
 * Creates the KEV catalog refresher. A refresh loads the feed and replaces the stored catalog
 * together with its fetch state in one transaction. Any failure (network, status, size, JSON,
 * schema, an empty or truncated list) only records the error, so the last good catalog stays in
 * use. A call during a running refresh joins it.
 * @param {KevRefresherDeps} deps - Database, feed loader, clock, logger, update callback
 * @returns {KevRefresher} - Refresher
 */
export const createKevRefresher = ({
  db,
  loadFeed,
  clock,
  log = console.error,
  onUpdated,
}: KevRefresherDeps): KevRefresher => {
  let running: Promise<boolean> | null = null

  /**
   * Loads and stores the feed once.
   * @returns {Promise<boolean>} - True when stored
   */
  const run = async (): Promise<boolean> => {
    const attemptAt = clock().toISOString()

    try {
      const feed = await loadFeed()

      inTransaction(db, () => {
        assertNotTruncated(feed, countKevEntries(db))
        replaceKevCatalog(db, feed.entries)
        recordKevSuccess(
          db,
          {
            catalogVersion: feed.catalogVersion,
            dateReleased: feed.dateReleased,
            entryCount: feed.entries.length,
          },
          attemptAt,
          clock().toISOString(),
        )
      })

      const skipped = feed.skipped > 0 ? `, ${feed.skipped} invalid entries skipped` : ''

      log(
        `[sieb] KEV catalog ${feed.catalogVersion ?? 'without version'} stored: ` +
          `${feed.entries.length} entries${skipped}`,
      )
      onUpdated?.()
      return true
    } catch (error) {
      const state = readKevFeedState(db)
      const kept = state.lastSuccessAt
        ? `keeping ${state.entryCount} entries from ${state.lastSuccessAt}`
        : 'no catalog stored yet'

      log(`[sieb] KEV catalog fetch failed: ${messageOf(error)}, ${kept}`)

      try {
        recordKevFailure(db, messageOf(error), attemptAt)
      } catch (recordError) {
        log(`[sieb] KEV catalog failure not recorded: ${messageOf(recordError)}`)
      }

      return false
    }
  }

  return {
    refresh: () => {
      running ??= run().finally(() => {
        running = null
      })
      return running
    },
  }
}
