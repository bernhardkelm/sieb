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
  checkId?: number | null // Auto-check whose token files it, null or absent for every other caller
  publicRegistries: readonly string[]
  now: Date
}

/**
 * Finds the open proposal the new one replaces for the same target: for an Auto-check the one
 * that check filed, else the proposer's own one that no Auto-check filed.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalInput} input - New proposal
 * @param {{ proposedBy: string; checkId: number | null }} origin - Proposer and check
 * @returns {Proposal | null} - Open proposal to replace, null when none
 */
const findReplaced = (
  db: DatabaseSync,
  input: ProposalInput,
  { proposedBy, checkId }: { proposedBy: string; checkId: number | null },
): Proposal | null =>
  listProposals(db, { state: 'open', vulnId: input.vulnId, proposedBy, checkId }).find(
    (open) => open.scope === input.scope && proposalTargetKey(open) === proposalTargetKey(input),
  ) ?? null

/**
 * Files a proposal. Every target image needs an open finding of the vulnerability, scope all at
 * least one. The proposal records the source access of its images and the decisions governing
 * its targets and replaces the open proposal of the same origin for the same target, see
 * findReplaced. A user's own proposal is refused once they hold MAX_OPEN_PROPOSALS others; an
 * Auto-check only ever targets its finding and holds one. Nothing about suppression changes.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalInput} input - Validated proposal
 * @param {CreateProposalContext} context - Proposer, public registries and current time
 * @returns {CreateProposalResult} - Stored proposal with the replaced id, or the refusal
 */
export const createProposal = (
  db: DatabaseSync,
  input: ProposalInput,
  { proposer, checkId = null, publicRegistries, now }: CreateProposalContext,
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

    const replaced = findReplaced(db, input, { proposedBy: proposer.proposedBy, checkId })

    if (
      checkId === null &&
      countOpenProposals(db, proposer.proposedBy) - (replaced ? 1 : 0) >= MAX_OPEN_PROPOSALS
    ) {
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

    const id = insertProposal(
      db,
      {
        ...input,
        ...proposer,
        sourceAccess: images.map((imageRef) => ({
          imageRef,
          access: sourceAccess(imageRef, open.get(imageRef)?.owner ?? null, publicRegistries),
        })),
        basisDecisions: currentDecisionRefs(input, listDecisionsByVuln(db, input.vulnId)),
        createdAt: at,
      },
      checkId,
    )
    const proposal = getProposal(db, id)

    if (!proposal) {
      throw new Error(`proposal ${id} vanished`)
    }

    return { ok: true, proposal, replacedProposalId: replaced?.id ?? null }
  })
