import type { KevFeedStatus } from '#core/kev.ts'
import { formatAbsolute } from '@/format/relativeTime'

/**
 * Returns whether the stored CISA catalog needs attention: stale after at least one fetch
 * attempt, so the first fetch after a start does not count.
 * @param {KevFeedStatus | null} feed - Catalog health, null for other KEV sources
 * @returns {boolean} - True when the catalog is stale
 */
export const isKevFeedStale = (feed: KevFeedStatus | null): boolean =>
  feed !== null && feed.stale && feed.lastAttemptAt !== null

/**
 * Describes the health of the stored CISA catalog for the sync status tooltip.
 * @param {KevFeedStatus | null} feed - Catalog health, null for other KEV sources
 * @returns {string | null} - One line, null for other KEV sources
 */
export const describeKevFeed = (feed: KevFeedStatus | null): string | null => {
  if (feed === null) {
    return null
  }

  if (feed.lastSuccessAt === null) {
    return feed.lastError === null
      ? 'KEV catalog not fetched yet'
      : `KEV catalog not fetched yet: ${feed.lastError}`
  }

  const version = feed.catalogVersion ? ` ${feed.catalogVersion}` : ''
  const updated = `KEV catalog${version} from ${formatAbsolute(feed.lastSuccessAt)}`

  return feed.lastError === null ? updated : `${updated}, last fetch failed: ${feed.lastError}`
}
