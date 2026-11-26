// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DatabaseSync } from 'node:sqlite'

import type { SourceSnapshot } from '#core/sourceSnapshot.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import type { FindingSource } from '#server/sources/FindingSource.ts'
import { createMockSource } from '#server/sources/mock/mockSource.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'
import { createSyncService } from '#server/sync/syncService.ts'

import { buildSnapshot, NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'

import { queuedSource, quiet } from './syncFixtures.ts'

const T1 = new Date('2026-06-01T00:00:00.000Z')
const T2 = new Date('2026-06-02T00:00:00.000Z')
const T3 = new Date('2026-06-03T00:00:00.000Z')
const T4 = new Date('2026-06-04T00:00:00.000Z')
const T5 = new Date('2026-06-05T00:00:00.000Z')
const VULN = 'CVE-2025-1000'
const OTHER = 'CVE-2025-2000'
const NOT_INITIAL = { initialImport: false }

type KevRow = [string, string, number, string | null]

/**
 * Reads vuln_id, image_ref, kev and kev_since of every finding.
 * @param {DatabaseSync} db - Database
 * @returns {KevRow[]} - Rows by id
 */
const kevRows = (db: DatabaseSync): KevRow[] =>
  (
    db
      .prepare('SELECT vuln_id, image_ref, kev, kev_since FROM findings ORDER BY id')
      .all() as unknown as {
      vuln_id: string
      image_ref: string
      kev: number
      kev_since: string | null
    }[]
  ).map((row) => [row.vuln_id, row.image_ref, row.kev, row.kev_since])

/**
 * Creates a sync service over a source whose clock advances through the given times.
 * @param {DatabaseSync} db - Database
 * @param {FindingSource} source - Source
 * @param {Date[]} times - Clock value per sync
 * @returns {() => Promise<void>} - Runs the next sync
 */
const syncs = (db: DatabaseSync, source: FindingSource, times: Date[]): (() => Promise<void>) => {
  let now = times[0] ?? T1
  const service = createSyncService({ db, source, clock: () => now, log: quiet })

  return async () => {
    now = times.shift() ?? now
    expect((await service.syncNow()).status).toBe('success')
  }
}

describe('kev_since', () => {
  it('leaves the initial import unmarked, marks later new KEV findings and flips', async () => {
    const db = openDatabase(MEMORY_DB)
    const nginx = { imageRef: NGINX }
    const redis = { imageRef: REDIS, resourceName: 'cache-0' }
    const other = { imageRef: NGINX, vulnId: OTHER }
    const snapshots: SourceSnapshot[] = [
      buildSnapshot([nginx, other], [VULN]),
      buildSnapshot([nginx, other, redis], [VULN]),
      buildSnapshot([nginx, other, redis], [VULN, OTHER]),
    ]
    const next = syncs(db, queuedSource(snapshots), [T1, T2, T3])

    await next()
    expect(kevRows(db)).toEqual([
      [VULN, NGINX, 1, null],
      [OTHER, NGINX, 0, null],
    ])

    await next()
    expect(kevRows(db)[2]).toEqual([VULN, REDIS, 1, T2.toISOString()])

    await next()
    expect(kevRows(db)).toEqual([
      [VULN, NGINX, 1, null],
      [OTHER, NGINX, 1, T3.toISOString()],
      [VULN, REDIS, 1, T2.toISOString()],
    ])
  })

  it('treats a snapshot as initial import only while no sync succeeded', () => {
    const db = openDatabase(MEMORY_DB)

    applySnapshot(db, buildSnapshot([{ imageRef: NGINX }], [VULN]), T1)
    applySnapshot(db, buildSnapshot([{ imageRef: REDIS }], [VULN]), T1, NOT_INITIAL)

    expect(kevRows(db).map((row) => row[3])).toEqual([null, T1.toISOString()])
  })

  it('clears when the flag turns off, keeps it without a KEV list and sets it again', () => {
    const db = openDatabase(MEMORY_DB)
    const nginx = { imageRef: NGINX }

    applySnapshot(db, buildSnapshot([nginx], [VULN]), T1, NOT_INITIAL)
    applySnapshot(db, buildSnapshot([nginx], []), T2, NOT_INITIAL)
    expect(kevRows(db)).toEqual([[VULN, NGINX, 0, null]])

    applySnapshot(db, buildSnapshot([nginx], null), T3, NOT_INITIAL)
    expect(kevRows(db)).toEqual([[VULN, NGINX, 0, null]])

    applySnapshot(db, buildSnapshot([nginx], [VULN]), T4, NOT_INITIAL)
    applySnapshot(db, buildSnapshot([nginx], null), T5, NOT_INITIAL)
    expect(kevRows(db)).toEqual([[VULN, NGINX, 1, T4.toISOString()]])
  })

  it('is not set for a finding inserted while the KEV list is unknown', () => {
    const db = openDatabase(MEMORY_DB)

    applySnapshot(db, buildSnapshot([{ imageRef: NGINX }], null), T1, NOT_INITIAL)

    expect(kevRows(db)).toEqual([[VULN, NGINX, 0, null]])
  })

  it('follows the KEV catalog entry the next mock state adds and drops', async () => {
    const db = openDatabase(MEMORY_DB)
    const source = createMockSource({ clock: () => T1 })
    const probe = createMockSource({ clock: () => T1 })
    const base = await probe.fetchSnapshot()
    const added = ((await probe.fetchSnapshot()).kevIds ?? []).filter(
      (id) => !(base.kevIds ?? []).includes(id),
    )
    const next = syncs(db, source, [T1, T2, T3])
    /**
     * Reads kev_since of the open findings of the added CVE and of the other KEV findings.
     * @returns {{ added: (string | null)[]; listed: (string | null)[] }} - Times
     */
    const times = (): { added: (string | null)[]; listed: (string | null)[] } => {
      const rows = db
        .prepare('SELECT vuln_id, kev_since FROM findings WHERE resolved_at IS NULL AND kev = 1')
        .all() as unknown as { vuln_id: string; kev_since: string | null }[]

      return {
        added: rows.filter((row) => added.includes(row.vuln_id)).map((row) => row.kev_since),
        listed: rows.filter((row) => !added.includes(row.vuln_id)).map((row) => row.kev_since),
      }
    }

    expect(added).toHaveLength(1)

    await next()
    const initial = times()

    await next()
    const flipped = times()

    await next()
    const back = times()

    expect(initial.listed.length).toBeGreaterThan(0)
    expect(initial).toEqual({ added: [], listed: initial.listed.map(() => null) })
    expect(flipped.added.length).toBeGreaterThan(0)
    expect(flipped.added.every((at) => at === T2.toISOString())).toBe(true)
    expect(flipped.listed.every((at) => at === null)).toBe(true)
    expect(back).toEqual({ added: [], listed: initial.listed })
  })
})
