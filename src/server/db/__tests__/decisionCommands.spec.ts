// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DecisionInput } from '#core/decision.ts'
import { NOW } from '#core/__tests__/coreBuilders.ts'
import { createBulkDecisions } from '#server/db/createBulkDecisions.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { getDecision } from '#server/db/decisionRepository.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { revokeDecision } from '#server/db/revokeDecision.ts'
import { updateDecision } from '#server/db/updateDecision.ts'

import { NGINX, REDIS, seededDatabase } from './dbFixtures.ts'

const LATER = new Date('2026-06-02T12:00:00.000Z')

const INPUT: DecisionInput = {
  vulnId: 'CVE-2025-1000',
  scope: 'image',
  imageRef: NGINX,
  status: 'accepted',
  reason: 'behind auth',
  expiresAt: '2026-08-30T12:00:00.000Z',
}

describe('createDecision', () => {
  it('stores the decision with the severity snapshot and a created event', () => {
    const db = seededDatabase(NOW)
    const result = createDecision(db, INPUT, 'dev', NOW)

    expect(result).toMatchObject({
      ok: true,
      decision: { id: 1, severityAtDecision: 'High', kevAtDecision: false, createdBy: 'dev' },
    })
    expect(listDecisionEvents(db, [1])).toMatchObject([{ type: 'created', actor: 'dev' }])
  })

  it('snapshots the highest open severity for scope all', () => {
    const db = seededDatabase(NOW)
    const result = createDecision(db, { ...INPUT, scope: 'all', imageRef: null }, 'dev', NOW)

    expect(result).toMatchObject({ ok: true, decision: { severityAtDecision: 'High' } })
  })

  it('records a baseline per governed image, leaving out images with their own decision', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)
    const result = createDecision(db, { ...INPUT, scope: 'all', imageRef: null }, 'dev', NOW)

    expect(result).toMatchObject({
      ok: true,
      decision: {
        severityAtDecision: 'Medium',
        baselines: [
          { imageRef: REDIS, severity: 'Medium', kev: false, recordedAt: NOW.toISOString() },
        ],
      },
    })
    expect(getDecision(db, 1)?.baselines.map((baseline) => baseline.imageRef)).toEqual([NGINX])
  })

  it('hands an image back to the all-scope decision with a fresh baseline on revoke', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)
    createDecision(db, { ...INPUT, scope: 'all', imageRef: null }, 'dev', NOW)
    revokeDecision(db, 1, 'dev', LATER)

    expect(getDecision(db, 2)?.baselines).toMatchObject([
      { imageRef: NGINX, severity: 'High', recordedAt: LATER.toISOString() },
      { imageRef: REDIS, severity: 'Medium', recordedAt: NOW.toISOString() },
    ])
  })

  it('refuses a second current decision and unknown findings', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)

    expect(createDecision(db, INPUT, 'dev', NOW)).toEqual({
      ok: false,
      error: 'conflict',
      decisionId: 1,
    })
    expect(createDecision(db, { ...INPUT, vulnId: 'CVE-1999-1' }, 'dev', NOW)).toEqual({
      ok: false,
      error: 'unknown_finding',
    })
  })
})

describe('updateDecision', () => {
  it('records the changed fields as before and after', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)

    const result = updateDecision(
      db,
      1,
      { status: 'not_affected', reason: 'no shell' },
      'alex',
      LATER,
    )

    expect(result).toMatchObject({
      ok: true,
      decision: {
        status: 'not_affected',
        reason: 'no shell',
        expiresAt: null,
        updatedAt: LATER.toISOString(),
      },
    })
    expect(listDecisionEvents(db, [1])[1]).toMatchObject({
      type: 'updated',
      actor: 'alex',
      payload: {
        reconfirm: false,
        status: ['accepted', 'not_affected'],
        reason: ['behind auth', 'no shell'],
        expiresAt: ['2026-08-30T12:00:00.000Z', null],
      },
    })
  })

  it('refuses unknown and revoked decisions', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)
    revokeDecision(db, 1, 'dev', LATER)

    expect(updateDecision(db, 2, { reason: 'x' }, 'dev', LATER)).toEqual({
      ok: false,
      error: 'not_found',
    })
    expect(updateDecision(db, 1, { reason: 'x' }, 'dev', LATER)).toEqual({
      ok: false,
      error: 'revoked',
      decisionId: 1,
    })
  })
})

describe('createBulkDecisions', () => {
  it('names expired and re-opened existing decisions as skip reasons', () => {
    const db = seededDatabase(NOW)
    createDecision(db, { ...INPUT, expiresAt: '2026-06-02T00:00:00.000Z' }, 'dev', NOW)
    createDecision(db, { ...INPUT, imageRef: REDIS }, 'dev', NOW)
    db.prepare("UPDATE decisions SET reopened_at = ?, reopen_trigger = '{}' WHERE id = 2").run(
      NOW.toISOString(),
    )

    const outcome = createBulkDecisions(
      db,
      {
        vulnId: 'CVE-2025-1000',
        imageRefs: [NGINX, REDIS],
        status: 'accepted',
        reason: 'x',
        expiresAt: null,
      },
      'dev',
      LATER,
    )

    expect(outcome.skipped).toEqual([
      { imageRef: NGINX, reason: 'expired', decisionId: 1 },
      { imageRef: REDIS, reason: 'reopened', decisionId: 2 },
    ])
  })
})

describe('revokeDecision', () => {
  it('revokes once, writes an event and frees the slot for a new decision', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)

    expect(revokeDecision(db, 1, 'alex', LATER, 'fixed upstream')).toMatchObject({
      ok: true,
      decision: { revokedAt: LATER.toISOString(), revokedBy: 'alex' },
    })
    expect(revokeDecision(db, 1, 'alex', LATER)).toMatchObject({ ok: false, error: 'revoked' })
    expect(listDecisionEvents(db, [1])[1]).toMatchObject({
      type: 'revoked',
      payload: { comment: 'fixed upstream' },
    })
    expect(createDecision(db, INPUT, 'dev', LATER).ok).toBe(true)
  })
})
