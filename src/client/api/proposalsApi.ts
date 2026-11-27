import type {
  ProposalAcceptRequest,
  ProposalAcceptResponse,
  ProposalDetail,
  ProposalListItem,
  ProposalRejectResponse,
  ProposalStateFilter,
} from '#core/proposalApiTypes.ts'
import { apiRequest } from '@/api/apiRequest'
import { queryString } from '@/api/queryString'

export const PROPOSALS_URL = '/api/proposals'

/**
 * Fetches proposals, newest first.
 * @param {ProposalStateFilter} state - Only proposals in this state, open by default
 * @param {string} vulnId - Only proposals of this vulnerability
 * @returns {Promise<ProposalListItem[]>} - Proposals with freshness, severity, KEV and image count
 */
export const fetchProposals = (
  state?: ProposalStateFilter,
  vulnId?: string,
): Promise<ProposalListItem[]> => apiRequest(`${PROPOSALS_URL}${queryString({ state, vulnId })}`)

/**
 * Fetches the review detail of a proposal with sieb's facts per image.
 * @param {number} id - Proposal id
 * @returns {Promise<ProposalDetail>} - Detail
 * @throws {ApiError} - 404 for an unknown proposal
 */
export const fetchProposalDetail = (id: number): Promise<ProposalDetail> =>
  apiRequest(`${PROPOSALS_URL}/${id}`)

/**
 * Accepts a proposal, optionally with edits of status, justification, reason and expiry.
 * @param {number} id - Proposal id
 * @param {ProposalAcceptRequest} body - Decision ids the reviewer saw, optional edits
 * @returns {Promise<ProposalAcceptResponse>} - Closed proposal and the written decisions
 * @throws {ApiError} - 400 validation, 409 proposal_conflict or proposal_closed
 */
export const acceptProposal = (
  id: number,
  body: ProposalAcceptRequest,
): Promise<ProposalAcceptResponse> => apiRequest(`${PROPOSALS_URL}/${id}/accept`, 'POST', body)

/**
 * Rejects a proposal, the reason goes back to the proposer.
 * @param {number} id - Proposal id
 * @param {string} reason - Why the proposal is wrong, 1 to 2000 characters
 * @returns {Promise<ProposalRejectResponse>} - Closed proposal
 * @throws {ApiError} - 400 validation, 409 proposal_closed
 */
export const rejectProposal = (id: number, reason: string): Promise<ProposalRejectResponse> =>
  apiRequest(`${PROPOSALS_URL}/${id}/reject`, 'POST', { reason })
