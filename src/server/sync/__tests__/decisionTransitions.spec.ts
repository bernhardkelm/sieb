// @vitest-environment node
import type { DatabaseSync } from 'node:sqlite'

import { describe, expect, it } from 'vitest'

import type { DecisionInput } from '#core/decision.ts'
import type { SourceInstance, SourceSnapshot } from '#core/sourceSnapshot.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { listDecisionViews } from '#server/db/findingViews.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { updateDecision } from '#server/db/updateDecision.ts'
import { readMetricsInput } from '#server/metrics/readMetricsInput.ts'
import { createSyncService, type SyncService } from '#server/sync/syncService.ts'

import { buildSnapshot, NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'

import { queuedSource, quiet } from './syncFixtures.ts'

const VULN = 'CVE-2025-1000'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Builds rows of CVE-2025-1000 for nginx and optionally redis.
 * @param {Partial<SourceInstance> | null} nginx - nginx row, null leaves it out
 * @param {Partial<SourceInstance> | null} redis - redis row, null leaves it out
 * @returns {Partial<SourceInstance>[]} - Rows
 */
const rows = (
  nginx: Partial<SourceInstance> | null,
  redis: Partial<SourceInstance> | null = null,
): Partial<SourceInstance>[] => [
  ...(nginx ? [{ imageRef: NGINX, ...nginx }] : []),
  ...(redis ? [{ imageRef: REDIS, resourceName: 'cache-0', ...redis }] : []),
]

/**
 * Creates a database, a sync service over queued snapshots and a settable clock.
 * @param {SourceSnapshot[]} snapshots - Snapshots in sync order
 * @returns {{ db: DatabaseSync; sync: SyncService; at: (iso: string) => Date }} - Fixture
 */
const setup = (
  snapshots: SourceSnapshot[],
): { db: DatabaseSync; sync: SyncService; at: (iso: string) => Date } => {
  const db = openDatabase(MEMORY_DB)
  let now = new Date('2026-06-01T00:00:00.000Z')
  const sync = createSyncService({
    db,
    source: queuedSource(snapshots),
    clock: () => now,
    log: quiet,
  })

  return {
    db,
    sync,
    at: (iso) => {
      now = new Date(iso)
      return now
    },
  }
}

/**
 * Creates a decision of CVE-2025-1000.
 * @param {DatabaseSync} db - Database
 * @param {Partial<DecisionInput>} input - Fields to set
 * @param {Date} now - Decision time
 * @returns {number} - Decision id
 */
const decide = (db: DatabaseSync, input: Partial<DecisionInput>, now: Date): number => {
  const result = createDecision(
    db,
    {
      vulnId: VULN,
      scope: 'image',
      imageRef: NGINX,
      status: 'not_affected',
      justification: null,
      reason: 'x',
      expiresAt: null,
      ...input,
    },
    'dev',
    now,
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.decision.id
}

/**
 * Reads the state of one decision and the suppressed images.
 * @param {DatabaseSync} db - Database
 * @param {number} id - Decision id
 * @param {Date} now - Evaluation time
 * @returns {{ state: string | undefined; suppressed: string[] }} - State and suppressed images
 */
const observe = (
  db: DatabaseSync,
  id: number,
  now: Date,
): { state: string | undefined; suppressed: string[] } => ({
  state: listDecisionViews(db, now).find((view) => view.decision.id === id)?.effective.state,
  suppressed: readMetricsInput(db, now).suppressions.map((suppression) => suppression.imageRef),
})

/**
 * Lists the event types of a decision.
 * @param {DatabaseSync} db - Database
 * @param {number} id - Decision id
 * @returns {string[]} - Event types, oldest first
 */
const eventTypes = (db: DatabaseSync, id: number): string[] =>
  listDecisionEvents(db, [id]).map((event) => event.type)

describe('decision transitions during sync', () => {
  it('keeps a re-opened decision re-opened when the severity falls back, one event only', async () => {
    const { db, sync, at } = setup([
      buildSnapshot(rows({ severity: 'Medium' })),
      buildSnapshot(rows({ severity: 'Critical' })),
      buildSnapshot(rows({ severity: 'Medium' })),
      buildSnapshot(rows({ severity: 'Medium' })),
    ])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const id = decide(db, {}, now)

    await sync.syncNow()
    await sync.syncNow()
    await sync.syncNow()

    expect(observe(db, id, now)).toEqual({ state: 'reopened', suppressed: [] })
    expect(eventTypes(db, id)).toEqual(['created', 'reopened'])
    expect(listDecisionViews(db, now)[0]?.decision.reopenedAt).toBe(now.toISOString())
  })

  it('keeps a decision re-opened when the KEV listing disappears again', async () => {
    const { db, sync, at } = setup([
      buildSnapshot(rows({})),
      buildSnapshot(rows({}), [VULN]),
      buildSnapshot(rows({})),
    ])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const id = decide(db, {}, now)

    await sync.syncNow()
    await sync.syncNow()

    expect(observe(db, id, now)).toEqual({ state: 'reopened', suppressed: [] })
    expect(listDecisionEvents(db, [id])[1]?.payload).toMatchObject({ reason: 'kev_listed' })
  })

  it('re-opens an all-scope decision when a low image rises next to an own-decided critical one', async () => {
    const { db, sync, at } = setup([
      buildSnapshot(rows({ severity: 'Critical' }, { severity: 'Low' })),
      buildSnapshot(rows({ severity: 'Critical' }, { severity: 'High' })),
      buildSnapshot(rows({ severity: 'Critical' }, { severity: 'Low' })),
    ])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const own = decide(db, {}, now)
    const all = decide(db, { scope: 'all', imageRef: null }, now)

    expect(observe(db, all, now).suppressed).toEqual([NGINX, REDIS])

    await sync.syncNow()
    expect(observe(db, all, now)).toEqual({ state: 'reopened', suppressed: [NGINX] })

    await sync.syncNow()
    expect(observe(db, all, now)).toEqual({ state: 'reopened', suppressed: [NGINX] })
    expect(observe(db, own, now).state).toBe('active')
  })

  it('re-opens an all-scope decision when the lower of two governed images rises', async () => {
    const { db, sync, at } = setup([
      buildSnapshot(rows({ severity: 'Critical' }, { severity: 'Low' })),
      buildSnapshot(rows({ severity: 'Critical' }, { severity: 'High' })),
    ])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const all = decide(db, { scope: 'all', imageRef: null }, now)

    await sync.syncNow()

    expect(observe(db, all, now)).toEqual({ state: 'reopened', suppressed: [] })
  })

  it('covers an image the CVE newly appears in at its first sighting', async () => {
    const { db, sync, at } = setup([
      buildSnapshot(rows({ severity: 'Low' })),
      buildSnapshot(rows({ severity: 'Low' }, { severity: 'High' })),
      buildSnapshot(rows({ severity: 'Low' }, { severity: 'Critical' })),
    ])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const all = decide(db, { scope: 'all', imageRef: null }, now)

    await sync.syncNow()
    expect(observe(db, all, now)).toEqual({ state: 'active', suppressed: [NGINX, REDIS] })
    expect(listDecisionViews(db, now)[0]?.decision.baselines).toMatchObject([
      { imageRef: NGINX, severity: 'Low' },
      { imageRef: REDIS, severity: 'High' },
    ])

    await sync.syncNow()
    expect(observe(db, all, now).state).toBe('reopened')
  })

  it('re-arms a re-opened decision only on an explicit re-confirm', async () => {
    const { db, sync, at } = setup([
      buildSnapshot(rows({ severity: 'Medium' })),
      buildSnapshot(rows({ severity: 'Critical' })),
    ])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const id = decide(db, {}, now)
    await sync.syncNow()

    updateDecision(db, id, { reason: 'typo fixed' }, 'alex', now)
    expect(observe(db, id, now).state).toBe('reopened')

    const changed = updateDecision(db, id, { status: 'accepted' }, 'alex', now)
    expect(changed).toMatchObject({
      ok: true,
      decision: { expiresAt: new Date(now.getTime() + 90 * DAY_MS).toISOString() },
    })
    expect(observe(db, id, now).state).toBe('reopened')

    updateDecision(db, id, { reconfirm: true }, 'alex', now)
    expect(observe(db, id, now)).toEqual({ state: 'active', suppressed: [NGINX] })
    expect(
      listDecisionEvents(db, [id])
        .slice(2)
        .map((event) => event.payload),
    ).toEqual([
      { reconfirm: false, reason: ['x', 'typo fixed'] },
      {
        reconfirm: false,
        status: ['not_affected', 'accepted'],
        expiresAt: [null, new Date(now.getTime() + 90 * DAY_MS).toISOString()],
      },
      {
        reconfirm: true,
        severityAtDecision: ['Medium', 'Critical'],
        reopenedAt: [now.toISOString(), null],
      },
    ])
  })

  it('writes one expired event per expiry across repeated syncs', async () => {
    const { db, sync, at } = setup([0, 1, 2, 3, 4].map(() => buildSnapshot(rows({}))))
    const start = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const id = decide(db, { expiresAt: '2026-06-02T00:00:00.000Z' }, start)

    at('2026-06-03T00:00:00.000Z')
    await sync.syncNow()
    await sync.syncNow()
    updateDecision(db, id, { expiresAt: '2026-06-04T00:00:00.000Z' }, 'alex', start)
    at('2026-06-05T00:00:00.000Z')
    await sync.syncNow()
    await sync.syncNow()

    expect(eventTypes(db, id)).toEqual(['created', 'expired', 'updated', 'expired'])
  })

  it('drops the series when the expiry passes between syncs', async () => {
    const { db, sync, at } = setup([buildSnapshot(rows({}))])
    const now = at('2026-06-01T00:00:00.000Z')

    await sync.syncNow()
    const id = decide(db, { status: 'accepted', expiresAt: '2026-06-01T06:00:00.000Z' }, now)

    expect(observe(db, id, new Date('2026-06-01T05:59:59.999Z')).suppressed).toEqual([NGINX])
    expect(observe(db, id, new Date('2026-06-01T06:00:00.000Z'))).toEqual({
      state: 'expired',
      suppressed: [],
    })
  })
})
