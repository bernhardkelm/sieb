import type { DatabaseSync } from 'node:sqlite'

import type { ValidationIssue } from '#core/errorApiTypes.ts'
import type { ProposalInput } from '#core/proposalRecord.ts'
import { getFinding } from '#server/db/findingRepository.ts'

export interface RelatedFindingRules {
  targetImages: readonly string[] // images of the proposal target
  sameImageOnly: boolean // an Auto-check lists only findings on the images of its target
}

/**
 * Returns why related findings of a proposal are refused, per entry: an unknown or resolved
 * finding is unknown_finding, a finding of the target itself is_target and, for an Auto-check, a
 * finding on another image outside_image.
 * @param {DatabaseSync} db - Open database
 * @param {ProposalInput} input - Validated proposal
 * @param {RelatedFindingRules} rules - Target images and whether related findings must share them
 * @returns {ValidationIssue[]} - Problems, empty when every related finding is allowed
 */
export const relatedFindingIssues = (
  db: DatabaseSync,
  input: ProposalInput,
  { targetImages, sameImageOnly }: RelatedFindingRules,
): ValidationIssue[] => {
  const images = new Set(targetImages)

  return input.relatedFindings.flatMap(({ findingId }, index): ValidationIssue[] => {
    const field = `relatedFindings.${index}.findingId`
    const finding = getFinding(db, findingId)

    if (finding === null || finding.resolvedAt !== null) {
      return [{ field, code: 'unknown_finding' }]
    }

    if (
      finding.vulnId === input.vulnId &&
      (input.scope === 'all' || images.has(finding.imageRef))
    ) {
      return [{ field, code: 'is_target' }]
    }

    return sameImageOnly && !images.has(finding.imageRef) ? [{ field, code: 'outside_image' }] : []
  })
}
