// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import type { DecisionInput } from '#core/decision.ts'
import type { ProposalFix } from '#core/proposal.ts'
import { validateAcceptEdits } from '#core/proposalAcceptEdits.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/registryHost.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { createProposal } from '#server/db/createProposal.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { findCurrentDecision, getDecision } from '#server/db/decisionRepository.ts'
import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_16 } from '#server/db/migrations/migration16.ts'
import { MIGRATION_17 } from '#server/db/migrations/migration17.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { updateDecision } from '#server/db/updateDecision.ts'

import { NGINX, seededDatabase } from './dbFixtures.ts'

const LATER = new Date('2026-06-02T12:00:00.000Z')

const REVIEW = '2026-07-01T23:59:59.000Z'

const WAITING_FOR = 'k3s release bundling traefik 3.7.17 or later'

const UPSTREAM_FIX: ProposalFix = {
  action: 'k3s: wait for a release bundling traefik 3.7.17',
  layer: 'platform',
  fixedVersion: '3.7.17',
  change: null,
  effort: null,
  availability: 'upstream_pending',
  waitingFor: WAITING_FOR,
  interim: null,
}

const WAITING: DecisionInput = {
  vulnId: 'CVE-2025-1000',
  scope: 'image',
  imageRef: NGINX,
  status: 'fix_planned',
  justification: null,
  reason: 'no fixed k3s yet',
  expiresAt: REVIEW,
  upstreamPending: true,
  waitingFor: WAITING_FOR,
}

/**
 * Files an upstream_pending fix_planned proposal of dev for nginx and returns it.
 * @param {DatabaseSync} db - Seeded database
 * @param {string} reviewDate - Review date of the proposal
 * @returns {number} - Proposal id
 */
const proposeUpstream = (db: DatabaseSync, reviewDate = REVIEW): number => {
  const result = createProposal(
    db,
    buildProposalInput({
      verdict: 'fix_planned',
      justification: null,
      fix: UPSTREAM_FIX,
      review: { date: reviewDate, why: 'next k3s release' },
    }),
    { proposer: PROPOSER, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: NOW },
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.proposal.id
}

describe('migration 17', () => {
  it('follows migration 16 and keeps existing decisions as not waiting', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_16) + 1))
    db.prepare(
      `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, expires_at, created_by,
         created_at, updated_at, severity_at_decision, kev_at_decision)
       VALUES ('CVE-1', 'image', 'img/a', 'fix_planned', 'bump', NULL, 'dev', 't', 't', 'High', 0)`,
    ).run()
    runMigrations(db)

    expect(MIGRATIONS.indexOf(MIGRATION_17)).toBe(16)
    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(getDecision(db, 1)).toMatchObject({ upstreamPending: false, waitingFor: null })
  })

  it('refuses upstream rows that break the rules', () => {
    const db = new DatabaseSync(MEMORY_DB)
    const insert = (status: string, expires: string | null, flag: number, waiting: string | null) =>
      db
        .prepare(
          `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, expires_at,
             upstream_pending, waiting_for, created_by, created_at, updated_at,
             severity_at_decision, kev_at_decision)
           VALUES ('CVE-1', 'all', NULL, ?, 'x', ?, ?, ?, 'dev', 't', 't', 'High', 0)`,
        )
        .run(status, expires, flag, waiting)

    runMigrations(db)

    expect(() => insert('accepted', REVIEW, 1, 'k3s')).toThrow(/CHECK/)
    expect(() => insert('fix_planned', null, 1, 'k3s')).toThrow(/CHECK/)
    expect(() => insert('fix_planned', REVIEW, 1, null)).toThrow(/CHECK/)
    expect(() => insert('fix_planned', REVIEW, 0, 'k3s')).toThrow(/CHECK/)
    expect(() => insert('fix_planned', REVIEW, 1, 'k3s')).not.toThrow()
  })
})

describe('decisions waiting for upstream', () => {
  it('records changes of the upstream fields in the history', () => {
    const db = seededDatabase(NOW)

    createDecision(db, WAITING, 'dev', NOW)
    updateDecision(db, 1, { waitingFor: 'k3s 1.34' }, 'alex', LATER)
    const result = updateDecision(db, 1, { status: 'accepted' }, 'alex', LATER)

    expect(result).toMatchObject({
      ok: true,
      decision: { status: 'accepted', upstreamPending: false, waitingFor: null },
    })
    expect(listDecisionEvents(db, [1]).map((event) => event.payload)).toMatchObject([
      { upstreamPending: true, waitingFor: WAITING_FOR },
      { waitingFor: [WAITING_FOR, 'k3s 1.34'] },
      { status: ['fix_planned', 'accepted'], upstreamPending: [true, false] },
    ])
  })

  it('refuses a change that would wait without a review date or text', () => {
    const db = seededDatabase(NOW)

    createDecision(db, { ...WAITING, upstreamPending: false, waitingFor: null }, 'dev', NOW)

    expect(updateDecision(db, 1, { upstreamPending: true }, 'dev', LATER)).toEqual({
      ok: false,
      error: 'upstream_invalid',
      issue: { field: 'waitingFor', code: 'required' },
    })
    createDecision(db, { ...WAITING, imageRef: null, scope: 'all' }, 'dev', NOW)
    expect(updateDecision(db, 2, { expiresAt: null }, 'dev', LATER)).toMatchObject({
      ok: false,
      issue: { field: 'expiresAt', code: 'required' },
    })
    expect(getDecision(db, 2)).toMatchObject({ expiresAt: REVIEW, upstreamPending: true })
  })
})

describe('accepting an upstream_pending proposal', () => {
  it('carries waiting for upstream over to the decision', () => {
    const db = seededDatabase(NOW)
    const id = proposeUpstream(db)
    const proposal = getProposal(db, id)
    const plan = proposal ? validateAcceptEdits(proposal, undefined, NOW) : null

    if (!plan?.ok) {
      throw new Error('plan refused')
    }

    expect(plan.value.values).toMatchObject({
      status: 'fix_planned',
      expiresAt: REVIEW,
      upstreamPending: true,
      waitingFor: WAITING_FOR,
    })
    expect(
      acceptProposal(db, id, {
        expectedDecisionIds: [{ imageRef: NGINX, decisionId: null, updatedAt: null }],
        plan: plan.value,
        actor: 'alice',
        now: NOW,
      }),
    ).toMatchObject({ ok: true })
    expect(findCurrentDecision(db, 'CVE-2025-1000', 'image', NGINX)).toMatchObject({
      status: 'fix_planned',
      upstreamPending: true,
      waitingFor: WAITING_FOR,
    })
  })

  it('takes the reviewer edits and asks for a date once the review date passed', () => {
    const db = seededDatabase(NOW)
    const proposal = getProposal(db, proposeUpstream(db, '2026-06-01T18:00:00.000Z'))

    if (!proposal) {
      throw new Error('proposal missing')
    }

    expect(validateAcceptEdits(proposal, undefined, LATER)).toEqual({
      ok: false,
      errors: [{ field: 'edits.expiresAt', code: 'required' }],
    })
    expect(
      validateAcceptEdits(proposal, { expiresAt: REVIEW, waitingFor: 'k3s 1.34' }, LATER),
    ).toMatchObject({
      ok: true,
      value: {
        values: { upstreamPending: true, waitingFor: 'k3s 1.34' },
        editedFields: ['expiresAt', 'waitingFor'],
      },
    })
    expect(validateAcceptEdits(proposal, { status: 'accepted' }, LATER)).toMatchObject({
      ok: true,
      value: { values: { upstreamPending: false, waitingFor: null } },
    })
    expect(
      validateAcceptEdits(proposal, { upstreamPending: false, expiresAt: null }, LATER),
    ).toMatchObject({
      ok: true,
      value: {
        values: { upstreamPending: false, waitingFor: null },
        editedFields: ['upstreamPending'],
      },
    })
  })
})
