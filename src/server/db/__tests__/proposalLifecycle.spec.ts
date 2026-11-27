// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { MAX_OPEN_PROPOSALS } from '#core/proposalRecord.ts'
import { createProposal } from '#server/db/createProposal.ts'
import { getProposal, insertProposal } from '#server/db/proposalRepository.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'
import { supersedeResolvedProposals } from '#server/sync/supersedeResolvedProposals.ts'

import { buildSnapshot, NGINX, REDIS, seededDatabase } from './dbFixtures.ts'

const LATER = new Date('2026-06-02T12:00:00.000Z')

const CONTEXT = { proposer: PROPOSER, publicRegistries: [], now: NOW }

describe('proposal lifecycle', () => {
  it('refuses a proposal beyond the open cap of a proposer, a replacement still passes', () => {
    const db = seededDatabase(NOW)

    for (let index = 1; index < MAX_OPEN_PROPOSALS; index += 1) {
      insertProposal(db, {
        ...buildProposalInput({ imageRefs: [`img/${index}`] }),
        ...PROPOSER,
        sourceAccess: [],
        basisDecisions: [],
        createdAt: NOW.toISOString(),
      })
    }

    expect(createProposal(db, buildProposalInput(), CONTEXT)).toMatchObject({ ok: true })
    expect(createProposal(db, buildProposalInput(), CONTEXT)).toMatchObject({ ok: true })
    expect(createProposal(db, buildProposalInput({ imageRefs: [REDIS] }), CONTEXT)).toEqual({
      ok: false,
      error: 'too_many_proposals',
    })
    expect(
      createProposal(db, buildProposalInput({ imageRefs: [REDIS] }), {
        ...CONTEXT,
        proposer: { ...PROPOSER, proposedBy: 'bob' },
      }),
    ).toMatchObject({ ok: true })
  })

  it('reads a fix stored before the patch action and availability existed as without them', () => {
    const db = seededDatabase(NOW)
    const id = insertProposal(db, {
      ...buildProposalInput({ verdict: 'needs_patch', justification: null }),
      ...PROPOSER,
      sourceAccess: [],
      basisDecisions: [],
      createdAt: NOW.toISOString(),
    })

    db.prepare('UPDATE decision_proposals SET fix = ? WHERE id = ?').run(
      JSON.stringify({ fixedVersion: '1.2', change: 'bump nginx', effort: null }),
      id,
    )

    expect(getProposal(db, id)?.fix).toEqual({
      action: null,
      layer: null,
      fixedVersion: '1.2',
      change: 'bump nginx',
      effort: null,
      availability: null,
      waitingFor: null,
      interim: null,
    })
  })

  it('supersedes proposals whose findings all resolved in a sync', () => {
    const db = seededDatabase(NOW)
    const proposal = (imageRefs: string[] | null): number => {
      const result = createProposal(
        db,
        buildProposalInput(imageRefs === null ? { scope: 'all', imageRefs } : { imageRefs }),
        { ...CONTEXT, proposer: { ...PROPOSER, proposedBy: `user-${String(imageRefs)}` } },
      )

      return result.ok ? result.proposal.id : 0
    }
    const nginx = proposal([NGINX])
    const both = proposal([NGINX, REDIS])
    const all = proposal(null)

    applySnapshot(db, buildSnapshot([{ imageRef: REDIS }]), LATER)

    expect(supersedeResolvedProposals(db, LATER)).toBe(1)
    expect(getProposal(db, nginx)).toMatchObject({
      state: 'superseded',
      resolution: 'finding_resolved',
      resolvedBy: 'sieb',
      resolvedAt: LATER.toISOString(),
    })
    expect(getProposal(db, both)?.state).toBe('open')
    expect(getProposal(db, all)?.state).toBe('open')

    applySnapshot(db, buildSnapshot([{ vulnId: 'CVE-2025-2000', imageRef: NGINX }]), LATER)

    expect(supersedeResolvedProposals(db, LATER)).toBe(2)
    expect(getProposal(db, all)?.resolution).toBe('finding_resolved')
  })
})
