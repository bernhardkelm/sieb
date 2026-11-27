import type { ExpectedDecisionId } from '#core/proposalFreshness.ts'

/** Proposals one bulk accept or reject handles at most */
export const MAX_BULK_PROPOSALS = 100

/** Proposal of a bulk accept with the decisions the reviewer saw on its targets */
export interface BulkAcceptItem {
  id: number
  expectedDecisionIds: ExpectedDecisionId[]
}

/** Body of POST /api/proposals/bulk-accept */
export interface BulkAcceptRequest {
  items: BulkAcceptItem[]
}

/** Body of POST /api/proposals/bulk-reject */
export interface BulkRejectRequest {
  ids: number[]
  reason: string
}

export const BULK_PROPOSAL_OUTCOMES = [
  'accepted',
  'rejected',
  'outdated', // a governing decision changed since filing or since the Inbox showed it
  'inconclusive', // never becomes a decision
  'not_acceptable', // refused for another reason, such as an invalid stored value
  'not_open', // accepted, rejected or superseded meanwhile
  'not_found',
] as const

export type BulkProposalOutcome = (typeof BULK_PROPOSAL_OUTCOMES)[number]

export interface BulkProposalResult {
  id: number
  vulnId: string | null // null for an unknown proposal
  outcome: BulkProposalOutcome
}

/** Answer of both bulk routes, one result per requested proposal in request order */
export interface BulkProposalResponse {
  results: BulkProposalResult[]
}
