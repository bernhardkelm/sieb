import {
  MAX_BULK_PROPOSALS,
  type BulkAcceptItem,
  type BulkAcceptRequest,
  type BulkProposalResult,
  type BulkRejectRequest,
} from '#core/proposalBulk.ts'
import { apiRequest } from '@/api/apiRequest'
import { PROPOSALS_URL } from '@/api/proposalsApi'

/**
 * Sends items in batches of MAX_BULK_PROPOSALS, one after the other.
 * @param {readonly T[]} items - Items
 * @param {(batch: T[]) => Promise<{ results: BulkProposalResult[] }>} send - Sends one batch
 * @returns {Promise<BulkProposalResult[]>} - Results of every batch in order
 */
const inBatches = async <T>(
  items: readonly T[],
  send: (batch: T[]) => Promise<{ results: BulkProposalResult[] }>,
): Promise<BulkProposalResult[]> => {
  const results: BulkProposalResult[] = []

  for (let start = 0; start < items.length; start += MAX_BULK_PROPOSALS) {
    results.push(...(await send(items.slice(start, start + MAX_BULK_PROPOSALS))).results)
  }

  return results
}

/**
 * Accepts proposals unchanged, one at a time on the server and in batches of
 * MAX_BULK_PROPOSALS; outdated and inconclusive ones come back skipped.
 * @param {readonly BulkAcceptItem[]} items - Proposal ids with the decisions the Inbox showed
 * @returns {Promise<BulkProposalResult[]>} - Outcome per proposal in request order
 * @throws {ApiError} - 400 validation
 */
export const bulkAcceptProposals = (
  items: readonly BulkAcceptItem[],
): Promise<BulkProposalResult[]> =>
  inBatches(items, (batch) =>
    apiRequest(`${PROPOSALS_URL}/bulk-accept`, 'POST', {
      items: batch,
    } satisfies BulkAcceptRequest),
  )

/**
 * Rejects proposals with one reason that goes back to every proposer, in batches of
 * MAX_BULK_PROPOSALS.
 * @param {readonly number[]} ids - Proposal ids
 * @param {string} reason - Why the proposals are wrong, 1 to 2000 characters
 * @returns {Promise<BulkProposalResult[]>} - Outcome per proposal in request order
 * @throws {ApiError} - 400 validation
 */
export const bulkRejectProposals = (
  ids: readonly number[],
  reason: string,
): Promise<BulkProposalResult[]> =>
  inBatches(ids, (batch) =>
    apiRequest(`${PROPOSALS_URL}/bulk-reject`, 'POST', {
      ids: batch,
      reason,
    } satisfies BulkRejectRequest),
  )
