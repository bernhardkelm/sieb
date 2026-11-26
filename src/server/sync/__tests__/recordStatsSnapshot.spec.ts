// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { emptyOverviewStats } from '#core/overviewStats.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { insertStatsSnapshot, listStatsSnapshots } from '#server/db/statsSnapshotRepository.ts'
import { createSyncService } from '#server/sync/syncService.ts'

import { buildSnapshot, NGINX } from '#server/db/__tests__/dbFixtures.ts'

import { queuedSource, quiet } from './syncFixtures.ts'

const NOW = new Date('2026-06-01T00:00:00.000Z')
const EPOCH = new Date(0)

describe('stats snapshots of the sync', () => {
  it('records one snapshot per successful sync, linked to its run', async () => {
    const db = openDatabase(MEMORY_DB)
    const source = queuedSource([
      buildSnapshot(
        [{ severity: 'Critical', exposure: 'public' }, { imageRef: NGINX }],
        ['CVE-2025-1000'],
      ),
      new Error('kubectl timed out'),
    ])
    const sync = createSyncService({ db, source, clock: () => NOW, log: quiet })

    await sync.syncNow()
    await sync.syncNow()

    expect(listStatsSnapshots(db, EPOCH)).toEqual([
      {
        at: NOW.toISOString(),
        stats: expect.objectContaining({ open: 1, inbox: 1, kev: 1, public: 1, images: 1 }),
      },
    ])
    expect(db.prepare('SELECT sync_run_id FROM stats_snapshots').all()).toEqual([
      { sync_run_id: 1 },
    ])
  })

  it('deletes snapshots older than 180 days', async () => {
    const db = openDatabase(MEMORY_DB)
    const sync = createSyncService({
      db,
      source: queuedSource([buildSnapshot([{}])]),
      clock: () => NOW,
      log: quiet,
    })

    insertStatsSnapshot(db, { at: '2025-12-01T00:00:00.000Z', stats: emptyOverviewStats() }, null)
    insertStatsSnapshot(db, { at: '2025-12-04T00:00:00.000Z', stats: emptyOverviewStats() }, null)
    await sync.syncNow()

    expect(listStatsSnapshots(db, EPOCH).map((point) => point.at)).toEqual([
      '2025-12-04T00:00:00.000Z',
      NOW.toISOString(),
    ])
  })
})
