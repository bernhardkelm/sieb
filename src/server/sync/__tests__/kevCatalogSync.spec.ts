// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createDecision } from '#server/db/createDecision.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { listDecisionViews } from '#server/db/findingViews.ts'
import { readKevCatalogIds } from '#server/db/kevCatalogRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { createKevRefresher } from '#server/kev/kevRefresher.ts'
import type { KevFeed } from '#server/kev/parseKevFeed.ts'
import { withKevList } from '#server/sources/withKevList.ts'
import { createSyncService } from '#server/sync/syncService.ts'

import { buildSnapshot, NGINX } from '#server/db/__tests__/dbFixtures.ts'
import { kevFeedOf } from '#server/kev/__tests__/kevFeedFixtures.ts'

import { queuedSource, quiet } from './syncFixtures.ts'

const VULN = 'CVE-2025-1000'
const OTHER = 'CVE-2024-0001'
const NOW = new Date('2026-06-01T00:00:00.000Z')

/**
 * Creates a sync over the stored CISA catalog as the live sources use it with SIEB_KEV_SOURCE
 * cisa, the findings source answering the same CVE-2025-1000 nginx finding on every sync.
 * @param {KevFeed[]} feeds - Feeds the refresher loads in order
 * @param {number} syncs - Snapshots to queue
 * @returns {object} - Database, sync service and refresher
 */
const setup = (feeds: KevFeed[], syncs = 4) => {
  const db = openDatabase(MEMORY_DB)
  const source = queuedSource(
    Array.from({ length: syncs }, () => buildSnapshot([{ imageRef: NGINX }], null)),
  )
  const sync = createSyncService({
    db,
    source: withKevList(source, () => readKevCatalogIds(db)),
    clock: () => NOW,
    log: quiet,
  })
  const refresher = createKevRefresher({
    db,
    clock: () => NOW,
    log: quiet,
    loadFeed: async () => feeds.shift() ?? Promise.reject(new Error('offline')),
  })

  return { db, sync, refresher }
}

/**
 * Reads the KEV flag of the nginx finding.
 * @param {ReturnType<typeof setup>['db']} db - Database
 * @returns {boolean | undefined} - KEV flag
 */
const kevOf = (db: ReturnType<typeof setup>['db']): boolean | undefined =>
  listFindingsByVuln(db, VULN)[0]?.kev

describe('sync with the CISA catalog', () => {
  it('re-opens a decision when its CVE newly enters the catalog', async () => {
    const { db, sync, refresher } = setup([kevFeedOf([OTHER]), kevFeedOf([OTHER, VULN])])

    await refresher.refresh()
    await sync.syncNow()

    const created = createDecision(
      db,
      {
        vulnId: VULN,
        scope: 'image',
        imageRef: NGINX,
        status: 'not_affected',
        justification: null,
        reason: 'x',
        expiresAt: null,
      },
      'dev',
      NOW,
    )

    if (!created.ok) {
      throw new Error(created.error)
    }

    await sync.syncNow()
    expect(listDecisionViews(db, NOW)[0]?.effective.state).toBe('active')

    await refresher.refresh()
    await sync.syncNow()

    expect(kevOf(db)).toBe(true)
    expect(listDecisionViews(db, NOW)[0]?.effective.state).toBe('reopened')
    expect(listDecisionEvents(db, [created.decision.id]).at(-1)).toMatchObject({
      type: 'reopened',
      payload: { reason: 'kev_listed' },
    })
  })

  it('keeps stored KEV flags until the first catalog arrives and drops removed CVEs', async () => {
    const { db, sync, refresher } = setup([kevFeedOf([VULN]), kevFeedOf([OTHER])])

    await sync.syncNow()
    expect(kevOf(db)).toBe(false)

    db.exec('UPDATE findings SET kev = 1')
    await sync.syncNow()
    expect(kevOf(db)).toBe(true)

    await refresher.refresh()
    await refresher.refresh()
    await sync.syncNow()
    expect(kevOf(db)).toBe(false)
  })

  it('keeps using the last good catalog while fetches fail', async () => {
    const { db, sync, refresher } = setup([kevFeedOf([VULN])])

    await refresher.refresh()
    await refresher.refresh()
    await sync.syncNow()

    expect(kevOf(db)).toBe(true)
  })
})
