// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { emptyOverviewStats } from '#core/overviewStats.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { insertStatsSnapshot, listStatsSnapshots } from '#server/db/statsSnapshotRepository.ts'

const EPOCH = new Date(0)

describe('listStatsSnapshots', () => {
  it('reads the verdict counts of a snapshot', () => {
    const db = openDatabase(MEMORY_DB)
    const stats = { ...emptyOverviewStats(), open: 9, notAffected: 3, accepted: 2 }

    insertStatsSnapshot(db, { at: '2026-06-01T00:00:00.000Z', stats }, null)

    expect(listStatsSnapshots(db, EPOCH)).toEqual([{ at: '2026-06-01T00:00:00.000Z', stats }])
  })

  it('reads the verdict counts of a snapshot holding only their sum as null', () => {
    const db = openDatabase(MEMORY_DB)
    const { notAffected: _notAffected, accepted: _accepted, ...legacy } = emptyOverviewStats()

    db.prepare('INSERT INTO stats_snapshots (sync_run_id, taken_at, stats) VALUES (?, ?, ?)').run(
      null,
      '2026-05-01T00:00:00.000Z',
      JSON.stringify({ ...legacy, open: 9, suppressed: 5 }),
    )

    expect(listStatsSnapshots(db, EPOCH)).toEqual([
      {
        at: '2026-05-01T00:00:00.000Z',
        stats: { ...emptyOverviewStats(), open: 9, notAffected: null, accepted: null },
      },
    ])
  })
})
