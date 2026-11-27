import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { PROPOSAL_LIMITS as LIMITS } from '#core/proposal.ts'
import type { ProposalRelatedFinding } from '#core/proposalRecord.ts'
import { readProposalList, readProposalText } from '#core/proposalTextReaders.ts'

/**
 * Reads one related finding: a positive integer findingId not listed before and an optional note
 * capped like an unknown.
 * @param {unknown} value - Raw entry
 * @param {string} field - Field name of the entry
 * @param {Set<number>} seen - Finding ids of the entries before, added to
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalRelatedFinding | null} - Entry, null when invalid
 */
const readRelatedFinding = (
  value: unknown,
  field: string,
  seen: Set<number>,
  errors: ValidationIssue[],
): ProposalRelatedFinding | null => {
  if (!isPlainObject(value)) {
    errors.push({ field, code: 'invalid' })
    return null
  }

  const { findingId } = value
  const note = readProposalText(
    value.note,
    `${field}.note`,
    { max: LIMITS.relatedNote, multiline: true },
    errors,
  )

  if (typeof findingId !== 'number' || !Number.isSafeInteger(findingId) || findingId <= 0) {
    errors.push({
      field: `${field}.findingId`,
      code: findingId === undefined || findingId === null ? 'required' : 'invalid',
    })
    return null
  }

  if (seen.has(findingId)) {
    errors.push({ field: `${field}.findingId`, code: 'duplicate' })
    return null
  }

  seen.add(findingId)
  return { findingId, note }
}

/**
 * Reads the other open findings Claude says share the cause of the verdict: at most
 * PROPOSAL_LIMITS.relatedFindings entries, each finding once. Whether they are open, other than
 * the target and reachable for the caller is checked on create.
 * @param {unknown} value - Raw list
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalRelatedFinding[]} - Entries in the given order
 */
export const readRelatedFindings = (
  value: unknown,
  errors: ValidationIssue[],
): ProposalRelatedFinding[] => {
  const seen = new Set<number>()

  return readProposalList(
    value,
    'relatedFindings',
    LIMITS.relatedFindings,
    (item, field) => readRelatedFinding(item, field, seen, errors),
    errors,
  )
}

/**
 * Reads the one-sentence cause the related findings share, capped like the summary and only
 * allowed together with related findings.
 * @param {unknown} value - Raw value
 * @param {unknown} related - Raw related findings
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - Reason, null when absent or invalid
 */
export const readRelatedReason = (
  value: unknown,
  related: unknown,
  errors: ValidationIssue[],
): string | null => {
  const reason = readProposalText(value, 'relatedReason', { max: LIMITS.relatedReason }, errors)

  if (reason !== null && !(Array.isArray(related) && related.length > 0)) {
    errors.push({ field: 'relatedReason', code: 'not_allowed' })
    return null
  }

  return reason
}
