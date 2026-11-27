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
 * Lists the target images with private source access, now or when proposed, while the evidence
 * basis lacks the own source, so Claude could not have inspected them.
 * @param {ProposalDetail} detail - Proposal detail
 * @returns {string[]} - Image refs, empty when the own source was checked or none is private
 */
export const uninspectedPrivateImages = (detail: ProposalDetail): string[] => {
  if (detail.proposal.evidenceBasis.includes('own_source')) {
    return []
  }

  const refs = new Set<string>()

  for (const image of detail.images) {
    if (image.sourceAccess === 'private') {
      refs.add(image.imageRef)
    }
  }

  for (const entry of detail.proposal.sourceAccess) {
    if (entry.access === 'private') {
      refs.add(entry.imageRef)
    }
  }

  return [...refs].sort()
}
