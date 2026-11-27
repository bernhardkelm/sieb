import type { ProposalInboxItem } from '#core/inbox/inboxItem.ts'
import type { BulkAcceptItem, BulkProposalOutcome, BulkProposalResult } from '#core/proposalBulk.ts'
import { proposalItemKey } from '@/components/inbox/inboxItems'

/** Outcomes of proposals that stay open, their rows stay checked */
const STILL_OPEN: readonly BulkProposalOutcome[] = ['outdated', 'inconclusive', 'not_acceptable']

/**
 * Returns the Inbox keys of the proposals a bulk action handled, those that left the Inbox.
 * @param {readonly BulkProposalResult[]} results - Results of the batch
 * @returns {string[]} - Item keys of the handled proposals
 */
export const handledKeys = (results: readonly BulkProposalResult[]): string[] =>
  results
    .filter((result) => !STILL_OPEN.includes(result.outcome))
    .map((result) => proposalItemKey(result.id))

/**
 * Builds the items of a bulk accept: every proposal with the decisions the Inbox showed for it.
 * @param {readonly ProposalInboxItem[]} proposals - Checked proposals
 * @returns {BulkAcceptItem[]} - Accept items
 */
export const acceptItems = (proposals: readonly ProposalInboxItem[]): BulkAcceptItem[] =>
  proposals.map((item) => ({
    id: item.refs.proposalId,
    expectedDecisionIds: item.currentDecisionIds,
  }))
