import type { Proposal } from '#core/proposalRecord.ts'

/** Proposal as the HTTP API shows it to every user, without the proposer's token id */
export type ProposalView = Omit<Proposal, 'tokenId'>

/**
 * Returns the API view of a stored proposal, leaving out the token id of the proposer.
 * @param {Proposal} proposal - Stored proposal
 * @returns {ProposalView} - Proposal without tokenId
 */
export const toProposalView = (proposal: Proposal): ProposalView => {
  const { tokenId: _tokenId, ...view } = proposal

  return view
}
