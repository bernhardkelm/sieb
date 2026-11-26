import type { DatabaseSync } from 'node:sqlite'

import {
  MAX_OPEN_PROPOSALS,
  proposalTargetKey,
  type Proposal,
  type ProposalInput,
  type ProposalProposer,
} from '#core/proposal.ts'
import { currentDecisionRefs } from '#core/proposalFreshness.ts'
import { sourceAccess } from '#core/sourceAccess.ts'
import { listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import type { CreateProposalResult } from '#server/db/proposalCommandResult.ts'
import {
  countOpenProposals,
  getProposal,
  insertProposal,
  listProposals,
  resolveProposal,
} from '#server/db/proposalRepository.ts'

export interface CreateProposalContext {
  proposer: ProposalProposer
  publicRegistries: readonly string[]
  now: Date
}

/**
 * Finds the open proposal of a proposer for the same target.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalInput} input - New proposal
 * @param {string} proposedBy - Proposing user
 * @returns {Proposal | null} - Open proposal to replace, null when none
 */
const findReplaced = (
  db: DatabaseSync,
  input: ProposalInput,
  proposedBy: string,
): Proposal | null =>
  listProposals(db, { state: 'open', vulnId: input.vulnId, proposedBy }).find(
    (open) => open.scope === input.scope && proposalTargetKey(open) === proposalTargetKey(input),
  ) ?? null

/**
 * Files a proposal. Every target image needs an open finding of the vulnerability, scope all at
 * least one. The proposal records the source access of its images and the decisions governing
 * its targets, replaces the open proposal of the same proposer for the same target, and is
 * refused once the proposer holds MAX_OPEN_PROPOSALS others. Nothing about suppression changes.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalInput} input - Validated proposal
 * @param {CreateProposalContext} context - Proposer, public registries and current time
 * @returns {CreateProposalResult} - Stored proposal with the replaced id, or the refusal
 */
export const createProposal = (
  db: DatabaseSync,
  input: ProposalInput,
  { proposer, publicRegistries, now }: CreateProposalContext,
): CreateProposalResult =>
  inTransaction(db, () => {
    const open = new Map(
      listFindingsByVuln(db, input.vulnId)
        .filter((finding) => finding.resolvedAt === null)
        .map((finding) => [finding.imageRef, finding]),
    )
    const missing = (input.imageRefs ?? []).filter((imageRef) => !open.has(imageRef))

    if (missing.length > 0 || open.size === 0) {
      return { ok: false, error: 'unknown_finding', imageRefs: missing }
    }

    const replaced = findReplaced(db, input, proposer.proposedBy)

    if (countOpenProposals(db, proposer.proposedBy) - (replaced ? 1 : 0) >= MAX_OPEN_PROPOSALS) {
      return { ok: false, error: 'too_many_proposals' }
    }

    const at = now.toISOString()
    const images = input.imageRefs ?? [...open.keys()].sort()

    if (replaced) {
      resolveProposal(db, replaced.id, {
        state: 'superseded',
        resolution: 'replaced',
        note: null,
        decisionIds: [],
        at,
        by: proposer.proposedBy,
      })
    }

    const id = insertProposal(db, {
      ...input,
      ...proposer,
      sourceAccess: images.map((imageRef) => ({
        imageRef,
        access: sourceAccess(imageRef, open.get(imageRef)?.owner ?? null, publicRegistries),
      })),
      basisDecisions: currentDecisionRefs(input, listDecisionsByVuln(db, input.vulnId)),
      createdAt: at,
    })
    const proposal = getProposal(db, id)

    if (!proposal) {
      throw new Error(`proposal ${id} vanished`)
    }

    return { ok: true, proposal, replacedProposalId: replaced?.id ?? null }
  })
