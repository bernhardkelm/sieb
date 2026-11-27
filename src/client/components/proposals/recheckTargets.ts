import type { ProposalDetail, ProposalImageFacts } from '#core/apiTypes.ts'
import type { HandoffInput } from '#core/handoffPrompt.ts'

/** Target image of a proposal with an open finding, what a re-check can look at */
export type RecheckImage = ProposalImageFacts & { findingId: number }

/**
 * Returns the target images of a proposal that still have an open finding.
 * @param {ProposalDetail} detail - Proposal detail
 * @returns {RecheckImage[]} - Images in the order of the detail
 */
export const recheckImages = (detail: ProposalDetail): RecheckImage[] =>
  detail.images.filter((image): image is RecheckImage => image.open && image.findingId !== null)

/**
 * Returns the hand-off input of one target image from sieb's facts in the proposal detail, its
 * current package versions standing in for the open instances.
 * @param {string} vulnId - Vulnerability of the proposal
 * @param {RecheckImage} image - Target image with an open finding
 * @returns {HandoffInput} - Finding and instances for the hand-off prompts
 */
export const handoffInputOf = (vulnId: string, image: RecheckImage): HandoffInput => ({
  finding: {
    id: image.findingId,
    vulnId,
    imageRef: image.imageRef,
    owner: image.owner,
    packages: [
      ...new Set(image.versions.flatMap((version) => (version.package ? [version.package] : []))),
    ],
  },
  instances: image.versions.map((version) => ({ package: version.package, resolvedAt: null })),
})
