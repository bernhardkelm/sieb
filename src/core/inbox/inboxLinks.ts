/**
 * Returns the link that opens a proposal in the review panel of the Inbox.
 * @param {string} base - Link base from linkBase
 * @param {number} proposalId - Proposal id
 * @returns {string} - URL
 */
export const proposalReviewUrl = (base: string, proposalId: number): string =>
  `${base}/inbox/proposals/${proposalId}`
