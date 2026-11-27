import { withoutImageTag } from '#core/nameMatch.ts'
import type { CheckScope } from '#server/mcp/mcpCaller.ts'
import type { ProposalTargetArgs } from '#server/mcp/proposalTarget.ts'

/**
 * Describes what a check token reaches, for the tool errors of a check caller.
 * @param {CheckScope} scope - Check scope
 * @returns {string} - Error text
 */
export const outsideCheckText = (scope: CheckScope): string =>
  `this Auto-check token only reaches finding ${scope.findingId}: ${scope.vulnId} in ${scope.imageRef}`

/**
 * Returns whether a vulnerability id names the check's CVE, case-insensitive.
 * @param {CheckScope} scope - Check scope
 * @param {string} vulnId - Vulnerability id
 * @returns {boolean} - True for the check's CVE
 */
export const isCheckVuln = (scope: CheckScope, vulnId: string): boolean =>
  vulnId.trim().toLowerCase() === scope.vulnId.toLowerCase()

/**
 * Returns whether an image ref names the check's image, case-insensitive with tag and digest
 * ignored.
 * @param {CheckScope} scope - Check scope
 * @param {string} imageRef - Image ref
 * @returns {boolean} - True for the check's image
 */
export const isCheckImage = (scope: CheckScope, imageRef: string): boolean =>
  withoutImageTag(imageRef.trim()).toLowerCase() === scope.imageRef.toLowerCase()

/**
 * Returns why a check caller may not file a proposal for a target: only the check's finding, by
 * findingId or by its CVE with exactly its image, never all images.
 * @param {CheckScope | null} scope - Check scope, null for every other caller
 * @param {ProposalTargetArgs} args - Tool arguments naming the target
 * @returns {string | null} - Error text, null when the target is allowed
 */
export const checkTargetError = (
  scope: CheckScope | null,
  { findingId, vulnId, imageRefs, all }: ProposalTargetArgs,
): string | null => {
  if (scope === null) {
    return null
  }

  const ownFinding =
    findingId === scope.findingId && vulnId === undefined && imageRefs === undefined && all !== true
  const ownImage =
    findingId === undefined &&
    all !== true &&
    vulnId !== undefined &&
    isCheckVuln(scope, vulnId) &&
    imageRefs !== undefined &&
    imageRefs.length > 0 &&
    imageRefs.every((ref) => isCheckImage(scope, ref))

  return ownFinding || ownImage ? null : outsideCheckText(scope)
}
