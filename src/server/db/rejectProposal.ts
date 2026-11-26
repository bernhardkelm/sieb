import type { DatabaseSync } from 'node:sqlite'

import { inTransaction } from '#server/db/inTransaction.ts'
import type { RejectProposalResult } from '#server/db/proposalCommandResult.ts'
import { getProposal, resolveProposal } from '#server/db/proposalRepository.ts'

/**
 * Rejects an open proposal with the reason the proposer reads back through list_my_proposals.
 * Decisions stay untouched.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Proposal id
 * @param {string} reason - Validated reject reason
 * @param {string} actor - Rejecting user
 * @param {Date} now - Current time
 * @returns {RejectProposalResult} - Rejected proposal or the refusal
 */
export const rejectProposal = (
  db: DatabaseSync,
  id: number,
  reason: string,
  actor: string,
  now: Date,
): RejectProposalResult =>
  inTransaction(db, () => {
    const proposal = getProposal(db, id)

    if (!proposal) {
      return { ok: false, error: 'not_found' }
    }

    if (proposal.state !== 'open') {
      return { ok: false, error: 'proposal_closed', state: proposal.state }
    }

    resolveProposal(db, id, {
      state: 'rejected',
      resolution: 'rejected',
      note: reason,
      decisionIds: [],
      at: now.toISOString(),
      by: actor,
    })

    const rejected = getProposal(db, id)

    if (!rejected) {
      throw new Error(`proposal ${id} vanished`)
    }

    return { ok: true, proposal: rejected }
  })
