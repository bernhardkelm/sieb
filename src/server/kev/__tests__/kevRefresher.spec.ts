// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { getKevDetails, readKevCatalogIds } from '#server/db/kevCatalogRepository.ts'
import { readKevFeedState, readKevFeedStatus } from '#server/db/kevFeedRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { createKevRefresher } from '#server/kev/kevRefresher.ts'
import type { KevFeed } from '#server/kev/parseKevFeed.ts'

import { kevFeedOf } from '#server/kev/__tests__/kevFeedFixtures.ts'

const START = new Date('2026-11-26T06:00:00.000Z')

/**
 * Creates a refresher over a fresh database whose loader answers queued feeds or errors.
 * @param {(KevFeed | Error)[]} results - Loader results in call order
 * @returns {object} - Database, refresher, log and update spies, clock setter
 */
const setup = (results: (KevFeed | Error)[]) => {
  const db = openDatabase(MEMORY_DB)
  const log = vi.fn<(message: string) => void>()
  const onUpdated = vi.fn<() => void>()
  let now = START
  const refresher = createKevRefresher({
    db,
    clock: () => now,
    log,
    onUpdated,
    loadFeed: async () => {
      const next = results.shift()

      if (!next || next instanceof Error) {
        throw next ?? new Error('no feed queued')
      }

      return next
    },
  })

  return {
    db,
    refresher,
    log,
    onUpdated,
    at: (iso: string) => {
      now = new Date(iso)
    },
  }
}

describe('createKevRefresher', () => {
  it('stores a feed with its version and reports the success', async () => {
    const { db, refresher, onUpdated } = setup([kevFeedOf(['CVE-2024-1', 'CVE-2024-2'])])

    expect(readKevCatalogIds(db)).toBeNull()
    expect(await refresher.refresh()).toBe(true)
    expect(readKevCatalogIds(db)).toEqual(['CVE-2024-1', 'CVE-2024-2'])
    expect(getKevDetails(db, 'CVE-2024-2')).toMatchObject({
      vulnerabilityName: 'CVE-2024-2 name',
      knownRansomware: false,
      dueDate: '2026-11-24',
    })
    expect(readKevFeedStatus(db, START)).toEqual({
      lastAttemptAt: START.toISOString(),
      lastSuccessAt: START.toISOString(),
      lastError: null,
      catalogVersion: '2026.11.24',
      entryCount: 2,
      stale: false,
    })
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })

  it('keeps the last good catalog when a fetch fails and logs the failure', async () => {
    const { db, refresher, log, onUpdated, at } = setup([
      kevFeedOf(['CVE-2024-1', 'CVE-2024-2']),
      new Error('GET https://www.cisa.gov failed with 503'),
      new Error('KEV feed lists no valid entry'),
    ])

    await refresher.refresh()
    at('2026-11-27T07:00:00.000Z')

    expect(await refresher.refresh()).toBe(false)
    expect(await refresher.refresh()).toBe(false)
    expect(readKevCatalogIds(db)).toEqual(['CVE-2024-1', 'CVE-2024-2'])
    expect(readKevFeedState(db)).toMatchObject({
      lastAttemptAt: '2026-11-27T07:00:00.000Z',
      lastSuccessAt: START.toISOString(),
      lastError: 'KEV feed lists no valid entry',
      entryCount: 2,
    })
    expect(log).toHaveBeenLastCalledWith(
      `[sieb] KEV catalog fetch failed: KEV feed lists no valid entry, keeping 2 entries from ${START.toISOString()}`,
    )
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })

  it('records a failure before the first success without a catalog', async () => {
    const { db, refresher } = setup([new TypeError('fetch failed')])

    await refresher.refresh()

    expect(readKevCatalogIds(db)).toBeNull()
    expect(readKevFeedStatus(db, START)).toMatchObject({
      lastSuccessAt: null,
      lastError: 'fetch failed',
      stale: true,
    })
  })

  it('rejects a feed that lost more than half of the stored entries', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `CVE-2024-${1000 + index}`)
    const { db, refresher } = setup([kevFeedOf(ids), kevFeedOf(ids.slice(0, 4))])

    await refresher.refresh()

    expect(await refresher.refresh()).toBe(false)
    expect(readKevCatalogIds(db)).toHaveLength(10)
    expect(readKevFeedState(db).lastError).toMatch(/4 entries against 10 stored, looks truncated/)
  })

  it('drops CVEs the feed no longer lists and clears the last error', async () => {
    const { db, refresher } = setup([
      kevFeedOf(['CVE-2024-1', 'CVE-2024-2']),
      new Error('offline'),
      kevFeedOf(['CVE-2024-2', 'CVE-2024-3'], '2026.11.25'),
    ])

    await refresher.refresh()
    await refresher.refresh()
    await refresher.refresh()

    expect(readKevCatalogIds(db)).toEqual(['CVE-2024-2', 'CVE-2024-3'])
    expect(getKevDetails(db, 'CVE-2024-1')).toBeNull()
    expect(readKevFeedState(db)).toMatchObject({ lastError: null, catalogVersion: '2026.11.25' })
  })

  it('joins a running refresh', async () => {
    const { refresher, onUpdated } = setup([kevFeedOf(['CVE-2024-1'])])
    const [first, second] = await Promise.all([refresher.refresh(), refresher.refresh()])

    expect([first, second]).toEqual([true, true])
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })
})
