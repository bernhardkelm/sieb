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
  justification: null,
  reason: 'behind auth',
  expiresAt: '2026-08-30T12:00:00.000Z',
}

const NOT_AFFECTED: DecisionInput = {
  ...INPUT,
  status: 'not_affected',
  justification: 'vulnerable_code_not_in_execute_path',
  expiresAt: null,
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

  it('stores the justification and records it in the created event', () => {
    const db = seededDatabase(NOW)

    expect(createDecision(db, NOT_AFFECTED, 'dev', NOW)).toMatchObject({
      ok: true,
      decision: { justification: 'vulnerable_code_not_in_execute_path' },
    })
    expect(getDecision(db, 1)?.justification).toBe('vulnerable_code_not_in_execute_path')
    expect(listDecisionEvents(db, [1])[0]?.payload).toMatchObject({
      status: 'not_affected',
      justification: 'vulnerable_code_not_in_execute_path',
    })
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
    expect(listDecisionEvents(db, [2]).at(-1)).toMatchObject({
      type: 'updated',
      actor: 'sieb',
      at: LATER.toISOString(),
      payload: { coveredImage: NGINX },
    })
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

  it('records a changed justification and keeps it on unrelated edits', () => {
    const db = seededDatabase(NOW)
    createDecision(db, NOT_AFFECTED, 'dev', NOW)

    updateDecision(db, 1, { justification: 'component_not_present' }, 'alex', LATER)
    const kept = updateDecision(db, 1, { reason: 'no shell' }, 'alex', LATER)
    const events = listDecisionEvents(db, [1])

    expect(kept).toMatchObject({ ok: true, decision: { justification: 'component_not_present' } })
    expect(events[1]?.payload).toEqual({
      reconfirm: false,
      justification: ['vulnerable_code_not_in_execute_path', 'component_not_present'],
    })
    expect(events[2]?.payload).toEqual({ reconfirm: false, reason: ['behind auth', 'no shell'] })

    updateDecision(db, 1, { justification: null }, 'alex', LATER)
    expect(getDecision(db, 1)?.justification).toBeNull()
  })

  it('clears the justification when the status leaves not_affected', () => {
    const db = seededDatabase(NOW)
    createDecision(db, NOT_AFFECTED, 'dev', NOW)

    expect(updateDecision(db, 1, { status: 'accepted' }, 'alex', LATER)).toMatchObject({
      ok: true,
      decision: { status: 'accepted', justification: null },
    })
    expect(listDecisionEvents(db, [1])[1]?.payload).toMatchObject({
      status: ['not_affected', 'accepted'],
      justification: ['vulnerable_code_not_in_execute_path', null],
    })
  })

  it('refuses a justification for a decision that is not not_affected', () => {
    const db = seededDatabase(NOW)
    createDecision(db, INPUT, 'dev', NOW)

    expect(
      updateDecision(db, 1, { justification: 'component_not_present' }, 'alex', LATER),
    ).toEqual({ ok: false, error: 'justification_not_allowed' })
    expect(listDecisionEvents(db, [1])).toHaveLength(1)
    expect(
      updateDecision(
        db,
        1,
        { status: 'not_affected', justification: 'component_not_present' },
        'alex',
        LATER,
      ),
    ).toMatchObject({ ok: true, decision: { justification: 'component_not_present' } })
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
        justification: null,
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
