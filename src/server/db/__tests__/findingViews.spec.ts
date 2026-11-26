// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { getFindingDetail, listDecisionViews, listFindingViews } from '#server/db/findingViews.ts'

import { NGINX, REDIS, seededDatabase } from './dbFixtures.ts'

describe('listFindingViews', () => {
  it('lists findings in inbox order with counts and their governing decision', () => {
    const db = seededDatabase(NOW)
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'all',
        imageRef: null,
        status: 'fix_planned',
        justification: null,
        reason: 'bump',
        expiresAt: null,
      },
      'dev',
      NOW,
    )

    const views = listFindingViews(db, NOW)

    expect(views.map((view) => [view.vulnId, view.imageRef, view.inInbox])).toEqual([
      ['CVE-2025-1000', NGINX, false],
      ['CVE-2025-1000', REDIS, false],
      ['CVE-2025-2000', NGINX, true],
    ])
    expect(views[0]).toMatchObject({
      instanceCount: 2,
      workloadCount: 1,
      namespaces: ['shop'],
      workloads: ['shop/ReplicaSet/web-6d4f'],
      packages: ['libcrypto3', 'libssl3'],
      effective: { state: 'fix_planned' },
    })
    expect(views[2]?.decision).toBeNull()
  })
})

describe('getFindingDetail', () => {
  it('returns instances, covering decisions and their history', () => {
    const db = seededDatabase(NOW)
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'image',
        imageRef: REDIS,
        status: 'accepted',
        justification: null,
        reason: 'x',
        expiresAt: null,
      },
      'dev',
      NOW,
    )
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'all',
        imageRef: null,
        status: 'not_affected',
        justification: null,
        reason: 'y',
        expiresAt: null,
      },
      'dev',
      NOW,
    )

    const detail = getFindingDetail(db, 1, NOW)

    expect(detail?.finding).toMatchObject({
      id: 1,
      imageRef: NGINX,
      decision: { id: 2 },
      inInbox: false,
    })
    expect(detail?.instances).toHaveLength(2)
    expect(detail?.decisions.map((view) => view.decision.id)).toEqual([2])
    expect(detail?.events.map((event) => [event.decisionId, event.type])).toEqual([[2, 'created']])
    expect(getFindingDetail(db, 99, NOW)).toBeNull()
  })
})

describe('listDecisionViews', () => {
  it('counts the open findings each decision governs', () => {
    const db = seededDatabase(NOW)
    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'all',
        imageRef: null,
        status: 'accepted',
        justification: null,
        reason: 'x',
        expiresAt: '2026-06-01T13:00:00.000Z',
      },
      'dev',
      NOW,
    )

    expect(listDecisionViews(db, NOW)).toMatchObject([
      { effective: { state: 'active' }, openFindings: 2 },
    ])
    expect(listDecisionViews(db, new Date('2026-06-02T00:00:00.000Z'))[0]?.effective.state).toBe(
      'expired',
    )
  })
})
