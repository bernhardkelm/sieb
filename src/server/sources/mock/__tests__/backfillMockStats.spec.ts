// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { readOverviewStats } from '#server/db/readOverviewStats.ts'
import { insertStatsSnapshot, listStatsSnapshots } from '#server/db/statsSnapshotRepository.ts'
import { backfillMockStats } from '#server/sources/mock/backfillMockStats.ts'

import { seededDatabase } from '#server/db/__tests__/dbFixtures.ts'

const NOW = new Date('2026-06-01T12:00:00.000Z')
const EPOCH = new Date(0)

describe('backfillMockStats', () => {
  it('seeds 30 days ending before the oldest snapshot and converging to the live stats', () => {
    const db = seededDatabase(NOW)
    const recent = '2026-06-01T08:00:00.000Z'

    insertStatsSnapshot(db, { at: recent, stats: readOverviewStats(db, NOW) }, null)

    expect(backfillMockStats(db, 'mock', NOW)).toBe(360)

    const points = listStatsSnapshots(db, EPOCH)

    expect(points).toHaveLength(361)
    expect(points.at(-2)?.at).toBe('2026-06-01T06:00:00.000Z')
    expect(points.at(-2)?.stats).toEqual(readOverviewStats(db, NOW))
    expect(points.at(-1)?.at).toBe(recent)
  })

  it('seeds once, as soon as history older than a day exists', () => {
    const db = seededDatabase(NOW)

    backfillMockStats(db, 'mock', NOW)

    expect(backfillMockStats(db, 'mock', NOW)).toBe(0)
    expect(listStatsSnapshots(db, EPOCH)).toHaveLength(360)
  })

  it('never seeds for the live sources', () => {
    const db = openDatabase(MEMORY_DB)

    expect(backfillMockStats(db, 'kubectl', NOW)).toBe(0)
    expect(backfillMockStats(db, 'incluster', NOW)).toBe(0)
    expect(listStatsSnapshots(db, EPOCH)).toEqual([])
  })
})
