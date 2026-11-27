// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import type { ProposalInput } from '#core/proposal.ts'
import { validateAcceptEdits } from '#core/proposalAccept.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { createProposal } from '#server/db/createProposal.ts'
import { findCurrentDecision } from '#server/db/decisionRepository.ts'
import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_15 } from '#server/db/migrations/migration15.ts'
import { MIGRATION_16 } from '#server/db/migrations/migration16.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { rejectProposal } from '#server/db/rejectProposal.ts'

import { NGINX, seededDatabase } from './dbFixtures.ts'

const LATER = new Date('2026-06-02T12:00:00.000Z')

const INCONCLUSIVE: Partial<ProposalInput> = {
  verdict: 'inconclusive',
  justification: null,
  confidence: 'low',
  missing: ['pull access to registry.example.com/app'],
}

/**
 * Files an inconclusive proposal of dev for nginx and returns its id.
 * @param {DatabaseSync} db - Seeded database
 * @param {Partial<ProposalInput>} overrides - Input fields to set
 * @returns {number} - Proposal id
 */
const proposeInconclusive = (db: DatabaseSync, overrides: Partial<ProposalInput> = {}): number => {
  const result = createProposal(db, buildProposalInput({ ...INCONCLUSIVE, ...overrides }), {
    proposer: PROPOSER,
    publicRegistries: DEFAULT_PUBLIC_REGISTRIES,
    now: NOW,
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.proposal.id
}

describe('inconclusive proposals', () => {
  it('stores what is missing and replaces the open one of the same proposer', () => {
    const db = seededDatabase(NOW)
    const first = proposeInconclusive(db)
    const second = createProposal(
      db,
      buildProposalInput({ ...INCONCLUSIVE, missing: ['advisory text not reachable'] }),
      { proposer: PROPOSER, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: NOW },
    )

    expect(second).toMatchObject({
      ok: true,
      replacedProposalId: first,
      proposal: { verdict: 'inconclusive', missing: ['advisory text not reachable'] },
    })
    expect(getProposal(db, first)).toMatchObject({ state: 'superseded', resolution: 'replaced' })
  })

  it('refuses an accept without the reviewer status and writes nothing', () => {
    const db = seededDatabase(NOW)
    const id = proposeInconclusive(db)
    const proposal = getProposal(db, id)

    if (!proposal) {
      throw new Error('proposal missing')
    }

    expect(validateAcceptEdits(proposal, undefined, LATER)).toMatchObject({
      ok: false,
      errors: [
        { field: 'edits.status', code: 'required' },
        { field: 'edits.reason', code: 'required' },
      ],
    })

    const result = acceptProposal(db, id, {
      expectedDecisionIds: [{ imageRef: NGINX, decisionId: null, updatedAt: null }],
      plan: {
        values: { status: 'accepted', justification: null, reason: 'x', expiresAt: null },
        editedFields: ['reason'],
      },
      actor: 'alice',
      now: LATER,
    })

    expect(result).toEqual({ ok: false, error: 'not_acceptable' })
    expect(getProposal(db, id)?.state).toBe('open')
    expect(findCurrentDecision(db, 'CVE-2025-1000', 'image', NGINX)).toBeNull()
  })

  it('becomes the decision the reviewer sets with status and reason', () => {
    const db = seededDatabase(NOW)
    const id = proposeInconclusive(db)
    const proposal = getProposal(db, id)
    const plan = proposal
      ? validateAcceptEdits(proposal, { status: 'fix_planned', reason: 'Rebuild next week' }, LATER)
      : null

    if (!plan?.ok) {
      throw new Error('invalid edits')
    }

    expect(plan.value.editedFields).toEqual(['status', 'reason'])

    const result = acceptProposal(db, id, {
      expectedDecisionIds: [{ imageRef: NGINX, decisionId: null, updatedAt: null }],
      plan: plan.value,
      actor: 'alice',
      now: LATER,
    })

    expect(result).toMatchObject({
      ok: true,
      proposal: { state: 'accepted', resolution: 'accepted_edited' },
      decisions: [{ status: 'fix_planned', reason: 'Rebuild next week' }],
    })
  })

  it('dismisses through reject with its reason', () => {
    const db = seededDatabase(NOW)
    const id = proposeInconclusive(db)

    expect(rejectProposal(db, id, 'Checked by hand', 'alice', LATER)).toMatchObject({
      ok: true,
      proposal: { state: 'rejected', resolutionNote: 'Checked by hand', verdict: 'inconclusive' },
    })
  })
})

describe('migration 16', () => {
  it('follows migration 15 and keeps the stored proposals with an empty missing list', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_15) + 1))
    db.exec(
      `INSERT INTO decision_proposals (id, vuln_id, scope, image_refs, target_key, verdict,
       summary, confidence, evidence, unknowns, refs, evidence_basis, source_access, proposed_by,
       proposed_via, token_id, client_label, basis_decisions, created_at, check_id, client_kind)
       VALUES (7, 'CVE-1', 'image', '["img/a"]', '["img/a"]', 'needs_patch', 'Reachable.',
       'high', '[]', '[]', '[]', '["image"]', '[]', 'alice', 'token', 1, 'laptop', '[]', 't', 3,
       'claude_app')`,
    )
    runMigrations(db)

    expect(MIGRATIONS.indexOf(MIGRATION_16)).toBe(15)
    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(getProposal(db, 7)).toMatchObject({
      verdict: 'needs_patch',
      missing: [],
      clientKind: 'claude_app',
    })
    expect(db.prepare('SELECT check_id FROM decision_proposals').get()).toEqual({ check_id: 3 })
  })

  it('ties the missing list to verdict inconclusive and keeps one open proposal per target', () => {
    const db = new DatabaseSync(MEMORY_DB)
    const insert = (verdict: string, missing: string, proposedBy = 'alice'): void => {
      db.prepare(
        `INSERT INTO decision_proposals (vuln_id, scope, image_refs, target_key, verdict,
         summary, confidence, evidence, unknowns, missing, refs, evidence_basis, source_access,
         proposed_by, proposed_via, token_id, client_label, basis_decisions, created_at)
         VALUES ('CVE-1', 'image', '["img/a"]', '["img/a"]', ?, 'Unclear.', 'low', '[]', '[]',
         ?, '[]', '["advisory"]', '[]', ?, 'token', 1, 'laptop', '[]', 't')`,
      ).run(verdict, missing, proposedBy)
    }

    runMigrations(db)
    insert('inconclusive', '["registry access"]')

    expect(() => insert('inconclusive', '[]', 'bob')).toThrow(/CHECK/)
    expect(() => insert('accepted', '["registry access"]', 'bob')).toThrow(/CHECK/)
    expect(() => insert('inconclusive', '["registry access"]')).toThrow(/UNIQUE/)
    expect(() =>
      db.exec(
        `UPDATE decision_proposals SET state = 'accepted', resolution = 'accepted',
         resolved_at = 't', resolved_by = 'bob'`,
      ),
    ).toThrow(/CHECK/)
  })
})
