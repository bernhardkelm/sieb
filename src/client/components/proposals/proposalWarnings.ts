import type { ProposalDetail } from '#core/proposalApiTypes.ts'

/**
 * Returns whether a not_affected verdict rests on the advisory alone.
 * @param {ProposalDetail} detail - Proposal detail
 * @returns {boolean} - True when only the advisory was checked
 */
export const isWeakEvidence = (detail: ProposalDetail): boolean => {
  const basis = detail.proposal.evidenceBasis

  return (
    detail.proposal.verdict === 'not_affected' &&
    basis.length > 0 &&
    basis.every((entry) => entry === 'advisory')
  )
}

/**
 * Lists the own target images, now or when proposed, while the evidence basis lacks the own
 * source, so Claude did not inspect their repository.
 * @param {ProposalDetail} detail - Proposal detail
 * @returns {string[]} - Image refs, empty when the own source was checked or none is own
 */
export const uninspectedOwnImages = (detail: ProposalDetail): string[] => {
  if (detail.proposal.evidenceBasis.includes('own_source')) {
    return []
  }

  const refs = new Set<string>()

  for (const image of detail.images) {
    if (image.ownership === 'own') {
      refs.add(image.imageRef)
    }
  }

  for (const entry of detail.proposal.imageAccess) {
    if (entry.ownership === 'own') {
      refs.add(entry.imageRef)
    }
  }

  return [...refs].sort()
}
