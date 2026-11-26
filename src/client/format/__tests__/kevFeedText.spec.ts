import { describe, expect, it } from 'vitest'

import type { KevFeedStatus } from '#core/kev.ts'
import { describeKevFeed, isKevFeedStale } from '@/format/kevFeedText'
import { formatAbsolute } from '@/format/relativeTime'

const SUCCESS = '2026-11-25T06:00:00.000Z'

/**
 * Builds a catalog health answer.
 * @param {Partial<KevFeedStatus>} overrides - Fields to set
 * @returns {KevFeedStatus} - Health
 */
const feed = (overrides: Partial<KevFeedStatus> = {}): KevFeedStatus => ({
  lastAttemptAt: SUCCESS,
  lastSuccessAt: SUCCESS,
  lastError: null,
  catalogVersion: '2026.11.24',
  entryCount: 1484,
  stale: false,
  ...overrides,
})

describe('kevFeedText', () => {
  it('describes the stored catalog and the last failure', () => {
    expect(describeKevFeed(null)).toBeNull()
    expect(describeKevFeed(feed())).toBe(`KEV catalog 2026.11.24 from ${formatAbsolute(SUCCESS)}`)
    expect(describeKevFeed(feed({ lastError: 'fetch failed', catalogVersion: null }))).toBe(
      `KEV catalog from ${formatAbsolute(SUCCESS)}, last fetch failed: fetch failed`,
    )
    expect(describeKevFeed(feed({ lastSuccessAt: null, lastError: 'GET failed with 503' }))).toBe(
      'KEV catalog not fetched yet: GET failed with 503',
    )
  })

  it('flags a stale catalog only after a fetch attempt', () => {
    expect(isKevFeedStale(null)).toBe(false)
    expect(isKevFeedStale(feed())).toBe(false)
    expect(isKevFeedStale(feed({ stale: true }))).toBe(true)
    expect(isKevFeedStale(feed({ stale: true, lastAttemptAt: null, lastSuccessAt: null }))).toBe(
      false,
    )
  })
})
