// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DatabaseSync } from 'node:sqlite'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import type { ProposalInput } from '#core/proposal.ts'
import type { ExpectedDecisionId } from '#core/proposalFreshness.ts'
import { validateAcceptEdits } from '#core/proposalAcceptEdits.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { createProposal } from '#server/db/createProposal.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { findCurrentDecision, getDecision } from '#server/db/decisionRepository.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { rejectProposal } from '#server/db/rejectProposal.ts'
import { updateDecision } from '#server/db/updateDecision.ts'

import { NGINX, REDIS, seededDatabase } from './dbFixtures.ts'

const LATER = new Date('2026-06-02T12:00:00.000Z')

/**
 * Files a proposal and returns its id.
 * @param {DatabaseSync} db - Seeded database
 * @param {Partial<ProposalInput>} overrides - Input fields to set
 * @param {string} proposedBy - Proposing user
 * @returns {number} - Proposal id
 */
const propose = (
  db: DatabaseSync,
  overrides: Partial<ProposalInput> = {},
  proposedBy = 'dev',
): number => {
  const result = createProposal(db, buildProposalInput(overrides), {
    proposer: { ...PROPOSER, proposedBy },
    publicRegistries: DEFAULT_PUBLIC_REGISTRIES,
    now: NOW,
  })

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.proposal.id
}

/**
 * Accepts a proposal with the given edits and the current decisions as expected.
 * @param {DatabaseSync} db - Database
 * @param {number} id - Proposal id
 * @param {Record<string, unknown>} edits - Raw edits
 * @param {{ imageRef: string | null; decisionId: number | null }[]} expected - Expected decisions
 * @returns {ReturnType<typeof acceptProposal>} - Result
 */
const accept = (
  db: DatabaseSync,
  id: number,
  edits: Record<string, unknown>,
  expected: ExpectedDecisionId[],
): ReturnType<typeof acceptProposal> => {
  const proposal = getProposal(db, id)
  const plan = proposal ? validateAcceptEdits(proposal, edits, LATER) : null

  if (!plan?.ok) {
    throw new Error('invalid edits')
  }

  return acceptProposal(db, id, {
    expectedDecisionIds: expected,
    plan: plan.value,
    actor: 'alice',
    now: LATER,
  })
}

describe('createProposal', () => {
  it('stores the proposal with source access and the governing decisions', () => {
    const db = seededDatabase(NOW)
    const id = propose(db, { imageRefs: [REDIS, NGINX].sort() })

    expect(getProposal(db, id)).toMatchObject({
      state: 'open',
      proposedBy: 'dev',
      sourceAccess: [
        { imageRef: NGINX, access: 'public' },
        { imageRef: REDIS, access: 'public' },
      ],
      basisDecisions: [
        { imageRef: NGINX, decisionId: null, updatedAt: null },
        { imageRef: REDIS, decisionId: null, updatedAt: null },
      ],
    })
  })

  it('refuses images without an open finding and vulnerabilities without one', () => {
    const db = seededDatabase(NOW)
    const context = { proposer: PROPOSER, publicRegistries: [], now: NOW }

    expect(
      createProposal(
        db,
        buildProposalInput({ vulnId: 'CVE-2025-2000', imageRefs: [REDIS] }),
        context,
      ),
    ).toEqual({ ok: false, error: 'unknown_finding', imageRefs: [REDIS] })
    expect(
      createProposal(
        db,
        buildProposalInput({ vulnId: 'CVE-9', scope: 'all', imageRefs: null }),
        context,
      ),
    ).toMatchObject({ ok: false, error: 'unknown_finding' })
  })

  it('replaces the open proposal of the same proposer for the same target only', () => {
    const db = seededDatabase(NOW)
    const first = propose(db)
    const other = propose(db, {}, 'bob')
    const wider = propose(db, { imageRefs: [NGINX, REDIS] })
    const result = createProposal(
      db,
      buildProposalInput({ verdict: 'accepted', justification: null }),
      {
        proposer: PROPOSER,
        publicRegistries: [],
        now: NOW,
      },
    )

    expect(result).toMatchObject({ ok: true, replacedProposalId: first })
    expect(getProposal(db, first)).toMatchObject({
      state: 'superseded',
      resolution: 'replaced',
      resolvedBy: 'dev',
    })
    expect(getProposal(db, other)?.state).toBe('open')
    expect(getProposal(db, wider)?.state).toBe('open')
  })
})

describe('acceptProposal', () => {
  it('creates a decision per image with provenance and supersedes overlapping proposals', () => {
    const db = seededDatabase(NOW)
    const id = propose(db, { imageRefs: [NGINX, REDIS] })
    const overlapping = propose(db, {}, 'bob')
    const all = propose(db, { scope: 'all', imageRefs: null }, 'bob')
    const result = accept(db, id, {}, [
      { imageRef: NGINX, decisionId: null, updatedAt: null },
      { imageRef: REDIS, decisionId: null, updatedAt: null },
    ])

    expect(result).toMatchObject({ ok: true, supersededIds: [overlapping] })
    expect(getProposal(db, id)).toMatchObject({
      state: 'accepted',
      resolution: 'accepted',
      resolvedBy: 'alice',
      decisionIds: [1, 2],
    })
    expect(getProposal(db, overlapping)?.resolution).toBe('other_accepted')
    expect(getProposal(db, all)?.state).toBe('open')
    expect(findCurrentDecision(db, 'CVE-2025-1000', 'image', REDIS)).toMatchObject({
      status: 'not_affected',
      justification: 'vulnerable_code_not_in_execute_path',
      createdBy: 'alice',
    })
    expect(listDecisionEvents(db, [1])[0]?.payload.provenance).toEqual({
      proposalId: id,
      proposedBy: 'dev',
      clientLabel: 'laptop',
      editedFields: [],
    })
  })

  it('updates and re-confirms an existing image decision, needs_patch as fix_planned', () => {
    const db = seededDatabase(NOW)
    const existing = createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'image',
        imageRef: NGINX,
        status: 'accepted',
        justification: null,
        reason: 'later',
        expiresAt: null,
        upstreamPending: false,
        waitingFor: null,
      },
      'bob',
      NOW,
    )
    const id = propose(db, {
      verdict: 'needs_patch',
      justification: null,
      fix: {
        action: 'upgrade nginx to 1.2',
        layer: null,
        fixedVersion: '1.2',
        change: 'bump nginx',
        effort: null,
        availability: null,
        waitingFor: null,
        interim: null,
      },
    })
    const result = accept(db, id, { reason: 'Patch it' }, [
      { imageRef: NGINX, decisionId: 1, updatedAt: NOW.toISOString() },
    ])

    expect(existing.ok).toBe(true)
    expect(result).toMatchObject({ ok: true, decisions: [{ id: 1, status: 'fix_planned' }] })
    expect(getProposal(db, id)?.resolution).toBe('accepted_edited')
    expect(listDecisionEvents(db, [1])[1]?.payload).toMatchObject({
      reconfirm: true,
      status: ['accepted', 'fix_planned'],
      reason: ['later', 'Patch it'],
      provenance: { proposalId: id, editedFields: ['reason'] },
    })
  })

  it('creates the all-scope decision for scope all', () => {
    const db = seededDatabase(NOW)
    const id = propose(db, {
      scope: 'all',
      imageRefs: null,
      verdict: 'accepted',
      justification: null,
    })

    expect(
      accept(db, id, {}, [{ imageRef: null, decisionId: null, updatedAt: null }]),
    ).toMatchObject({
      ok: true,
      decisions: [{ scope: 'all', imageRef: null, status: 'accepted' }],
    })
  })

  it('answers proposal_conflict when the decisions changed and writes nothing', () => {
    const db = seededDatabase(NOW)
    const id = propose(db)

    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'all',
        imageRef: null,
        status: 'accepted',
        justification: null,
        reason: 'x',
        expiresAt: null,
        upstreamPending: false,
        waitingFor: null,
      },
      'bob',
      NOW,
    )

    expect(accept(db, id, {}, [{ imageRef: NGINX, decisionId: null, updatedAt: null }])).toEqual({
      ok: false,
      error: 'proposal_conflict',
      currentDecisionIds: [{ imageRef: NGINX, decisionId: 1, updatedAt: NOW.toISOString() }],
    })
    expect(findCurrentDecision(db, 'CVE-2025-1000', 'image', NGINX)).toBeNull()
    expect(getProposal(db, id)?.state).toBe('open')
  })

  it('answers proposal_conflict when the expected decision was edited in place meanwhile', () => {
    const db = seededDatabase(NOW)

    createDecision(
      db,
      {
        vulnId: 'CVE-2025-1000',
        scope: 'image',
        imageRef: NGINX,
        status: 'accepted',
        justification: null,
        reason: 'internal only',
        expiresAt: null,
        upstreamPending: false,
        waitingFor: null,
      },
      'bob',
      NOW,
    )
    const id = propose(db)
    const seen = [{ imageRef: NGINX, decisionId: 1, updatedAt: NOW.toISOString() }]
    const edited = new Date(NOW.getTime() + 60 * 1000)

    updateDecision(db, 1, { reason: 'internal only, reviewed again' }, 'bob', edited)

    expect(accept(db, id, {}, seen)).toEqual({
      ok: false,
      error: 'proposal_conflict',
      currentDecisionIds: [{ imageRef: NGINX, decisionId: 1, updatedAt: edited.toISOString() }],
    })
    expect(getDecision(db, 1)?.reason).toBe('internal only, reviewed again')
    expect(getProposal(db, id)?.state).toBe('open')
    expect(accept(db, id, {}, [{ ...seen[0]!, updatedAt: edited.toISOString() }])).toMatchObject({
      ok: true,
    })
  })
})

describe('rejectProposal', () => {
  it('records the reason and refuses a second resolution', () => {
    const db = seededDatabase(NOW)
    const id = propose(db)

    expect(rejectProposal(db, id, 'Evidence is advisory only', 'alice', LATER)).toMatchObject({
      ok: true,
      proposal: { state: 'rejected', resolutionNote: 'Evidence is advisory only' },
    })
    expect(rejectProposal(db, id, 'again', 'alice', LATER)).toEqual({
      ok: false,
      error: 'proposal_closed',
      state: 'rejected',
    })
    expect(
      accept(db, id, {}, [{ imageRef: NGINX, decisionId: null, updatedAt: null }]),
    ).toMatchObject({
      error: 'proposal_closed',
    })
  })
})
