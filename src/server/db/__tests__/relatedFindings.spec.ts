// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DatabaseSync } from 'node:sqlite'

import { NOW } from '#core/__tests__/coreBuilders.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { validateAcceptEdits } from '#core/proposalAcceptEdits.ts'
import type { ProposalInput } from '#core/proposalRecord.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { createProposal } from '#server/db/createProposal.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import type { CreateProposalResult } from '#server/db/proposalCommandResult.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { getProposalDetail } from '#server/db/proposalViews.ts'

import { NGINX } from './dbFixtures.ts'
import { COREDNS, relatedDatabase, SIBLING_CVE, TARGET_CVE } from './relatedFixtures.ts'

/**
 * Files a proposal for TARGET_CVE in coredns with the given related findings.
 * @param {DatabaseSync} db - Seeded database
 * @param {Partial<ProposalInput>} overrides - Input fields to set
 * @param {number | null} checkId - Auto-check filing it, null for a personal token
 * @returns {CreateProposalResult} - Result
 */
const propose = (
  db: DatabaseSync,
  overrides: Partial<ProposalInput>,
  checkId: number | null = null,
): CreateProposalResult =>
  createProposal(
    db,
    buildProposalInput({ vulnId: TARGET_CVE, imageRefs: [COREDNS], ...overrides }),
    { proposer: PROPOSER, checkId, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: NOW },
  )

describe('createProposal with related findings', () => {
  it('stores the related findings and the shared reason and reads them back', () => {
    const { db, sibling, otherSibling } = relatedDatabase(NOW)
    const relatedFindings = [
      { findingId: sibling, note: 'same pseudo-version' },
      { findingId: otherSibling, note: null },
    ]
    const result = propose(db, { relatedFindings, relatedReason: 'Pseudo-version sorts low.' })

    expect(result.ok).toBe(true)
    expect(getProposal(db, result.ok ? result.proposal.id : 0)).toMatchObject({
      relatedFindings,
      relatedReason: 'Pseudo-version sorts low.',
    })
  })

  it('refuses unknown, resolved and target findings with one issue each', () => {
    const { db, target, resolved, sibling } = relatedDatabase(NOW)
    const result = propose(db, {
      relatedFindings: [
        { findingId: sibling, note: null },
        { findingId: 9999, note: null },
        { findingId: resolved, note: null },
        { findingId: target, note: null },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: 'invalid_related',
      issues: [
        { field: 'relatedFindings.1.findingId', code: 'unknown_finding' },
        { field: 'relatedFindings.2.findingId', code: 'unknown_finding' },
        { field: 'relatedFindings.3.findingId', code: 'is_target' },
      ],
    })
    expect(getProposal(db, 1)).toBeNull()
  })

  it('treats every image of the CVE as the target of an all-scope proposal', () => {
    const { db, elsewhere } = relatedDatabase(NOW)
    const result = createProposal(
      db,
      buildProposalInput({
        vulnId: SIBLING_CVE,
        scope: 'all',
        imageRefs: null,
        relatedFindings: [{ findingId: elsewhere, note: null }],
      }),
      { proposer: PROPOSER, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: NOW },
    )

    expect(result).toMatchObject({ ok: false, error: 'invalid_related' })
  })

  it('lets an Auto-check list only findings on its own image, other callers any open one', () => {
    const { db, sibling, elsewhere } = relatedDatabase(NOW)
    const related = [
      { findingId: sibling, note: null },
      { findingId: elsewhere, note: null },
    ]

    expect(propose(db, { relatedFindings: related }, 7)).toEqual({
      ok: false,
      error: 'invalid_related',
      issues: [{ field: 'relatedFindings.1.findingId', code: 'outside_image' }],
    })
    expect(propose(db, { relatedFindings: related.slice(0, 1) }, 7).ok).toBe(true)
    expect(propose(db, { relatedFindings: related }).ok).toBe(true)
  })
})

describe('accepting a proposal with related findings', () => {
  it('decides only its target and leaves the related findings undecided', () => {
    const { db, sibling, otherSibling, elsewhere } = relatedDatabase(NOW)
    const result = propose(db, {
      relatedFindings: [sibling, otherSibling, elsewhere].map((findingId) => ({
        findingId,
        note: null,
      })),
    })
    const proposal = result.ok ? result.proposal : null
    const plan = proposal ? validateAcceptEdits(proposal, undefined, NOW) : null

    if (!proposal || !plan?.ok) {
      throw new Error('setup failed')
    }

    const accepted = acceptProposal(db, proposal.id, {
      expectedDecisionIds: [{ imageRef: COREDNS, decisionId: null, updatedAt: null }],
      plan: plan.value,
      actor: 'alice',
      now: NOW,
    })

    expect(accepted.ok).toBe(true)
    expect(listDecisions(db).map(({ vulnId, imageRef }) => ({ vulnId, imageRef }))).toEqual([
      { vulnId: TARGET_CVE, imageRef: COREDNS },
    ])
  })
})

describe('getProposalDetail', () => {
  it('answers the current facts of each related finding in the filed order', () => {
    const { db, sibling, elsewhere } = relatedDatabase(NOW)
    const result = propose(db, {
      relatedFindings: [
        { findingId: elsewhere, note: 'nginx vendors coredns too' },
        { findingId: sibling, note: null },
      ],
      relatedReason: 'Pseudo-version sorts low.',
    })
    const id = result.ok ? result.proposal.id : 0

    db.prepare('UPDATE findings SET resolved_at = ? WHERE id = ?').run(NOW.toISOString(), sibling)

    const detail = getProposalDetail(db, id, {
      now: NOW,
      publicRegistries: DEFAULT_PUBLIC_REGISTRIES,
      kevDetails: false,
    })

    expect(detail?.related).toEqual([
      {
        findingId: elsewhere,
        note: 'nginx vendors coredns too',
        vulnId: SIBLING_CVE,
        imageRef: NGINX,
        open: true,
        sourceAccess: 'public',
        versions: [
          {
            package: 'github.com/coredns/coredns',
            installedVersion: 'v0.0.0-20260101000000-abcdef123456',
            fixedVersion: '1.11.0',
          },
        ],
        decision: null,
        effective: null,
      },
      expect.objectContaining({ findingId: sibling, vulnId: SIBLING_CVE, open: false }),
    ])
  })
})
