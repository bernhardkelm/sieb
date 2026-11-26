import type { ValidationIssue } from '#core/apiTypes.ts'
import { PROPOSAL_LIMITS } from '#core/proposal.ts'
import type { ExpectedDecisionId } from '#core/proposalFreshness.ts'
import { isPlainObject } from '#core/proposalTextReaders.ts'

/**
 * Reads one expected decision: imageRef a string or null for the all-scope target, decisionId a
 * positive integer with the updatedAt of that version, or both null for none.
 * @param {unknown} value - Raw entry
 * @returns {ExpectedDecisionId | null} - Entry, null when malformed
 */
const readEntry = (value: unknown): ExpectedDecisionId | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const { imageRef, decisionId, updatedAt } = value
  const validImage = imageRef === null || (typeof imageRef === 'string' && imageRef !== '')
  const validDecision =
    decisionId === null
      ? updatedAt === null
      : typeof decisionId === 'number' &&
        Number.isSafeInteger(decisionId) &&
        decisionId > 0 &&
        typeof updatedAt === 'string' &&
        !Number.isNaN(Date.parse(updatedAt))

  return validImage && validDecision
    ? { imageRef, decisionId: decisionId as number | null, updatedAt: updatedAt as string | null }
    : null
}

/**
 * Reads the decisions a reviewer saw per target of a proposal, as GET /api/proposals/:id
 * answers them in currentDecisionIds.
 * @param {unknown} value - Raw expectedDecisionIds
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ExpectedDecisionId[] | null} - Entries, null when missing or malformed
 */
export const readExpectedDecisionIds = (
  value: unknown,
  errors: ValidationIssue[],
): ExpectedDecisionId[] | null => {
  if (value === undefined || value === null) {
    errors.push({ field: 'expectedDecisionIds', code: 'required' })
    return null
  }

  if (!Array.isArray(value) || value.length === 0 || value.length > PROPOSAL_LIMITS.imageRefs) {
    errors.push({ field: 'expectedDecisionIds', code: 'invalid' })
    return null
  }

  const entries = value.map(readEntry)

  if (entries.some((entry) => entry === null)) {
    errors.push({ field: 'expectedDecisionIds', code: 'invalid' })
    return null
  }

  return entries.filter((entry) => entry !== null)
}
