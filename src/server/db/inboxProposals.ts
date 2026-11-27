import type { DatabaseSync } from 'node:sqlite'

import type { InboxProposal } from '#core/inbox/inboxItem.ts'
import { patchActionOf } from '#core/patchAction.ts'
import { listProposals } from '#server/db/proposalRepository.ts'

/**
 * Lists the open proposals with the fields the Inbox reads.
 * @param {DatabaseSync} db - Open database
 * @returns {InboxProposal[]} - Open proposals, newest first
 */
export const listInboxProposals = (db: DatabaseSync): InboxProposal[] =>
  listProposals(db, { state: 'open' }).map((proposal) => ({
    id: proposal.id,
    vulnId: proposal.vulnId,
    imageRefs: proposal.imageRefs,
    createdAt: proposal.createdAt,
    verdict: proposal.verdict,
    confidence: proposal.confidence,
    patchAction: patchActionOf(proposal),
  }))
