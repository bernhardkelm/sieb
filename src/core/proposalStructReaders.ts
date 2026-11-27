import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { readExpiry } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { PROPOSAL_LIMITS as LIMITS, type ProposalEvidence } from '#core/proposal.ts'
import type { ProposalReview } from '#core/proposalRecord.ts'
import { isHttpUrl, readProposalList, readProposalText } from '#core/proposalTextReaders.ts'

/**
 * Reads one evidence entry: check, method and result, all required.
 * @param {unknown} value - Raw entry
 * @param {string} field - Field name of the entry
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalEvidence | null} - Entry, null when invalid
 */
export const readEvidence = (
  value: unknown,
  field: string,
  errors: ValidationIssue[],
): ProposalEvidence | null => {
  if (!isPlainObject(value)) {
    errors.push({ field, code: 'invalid' })
    return null
  }

  const check = readProposalText(
    value.check,
    `${field}.check`,
    { max: LIMITS.evidenceCheck, required: true },
    errors,
  )
  const method = readProposalText(
    value.method,
    `${field}.method`,
    { max: LIMITS.evidenceMethod, required: true },
    errors,
  )
  const result = readProposalText(
    value.result,
    `${field}.result`,
    { max: LIMITS.evidenceResult, multiline: true, required: true },
    errors,
  )

  return check === null || method === null || result === null ? null : { check, method, result }
}

/**
 * Reads the proposed review: a date with the expiry rules of a decision and why.
 * @param {unknown} value - Raw review
 * @param {Date} now - Current time
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalReview | null} - Review, null when absent, empty or invalid
 */
export const readReview = (
  value: unknown,
  now: Date,
  errors: ValidationIssue[],
): ProposalReview | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (!isPlainObject(value)) {
    errors.push({ field: 'review', code: 'invalid' })
    return null
  }

  const dateErrors: DecisionInputError[] = []
  const date = readExpiry(value.date, now, dateErrors)

  errors.push(...dateErrors.map(({ code }) => ({ field: 'review.date', code })))

  const review: ProposalReview = {
    date: date ?? null,
    why: readProposalText(
      value.why,
      'review.why',
      { max: LIMITS.reviewWhy, multiline: true },
      errors,
    ),
  }

  return review.date === null && review.why === null ? null : review
}

/**
 * Reads the references: at most PROPOSAL_LIMITS.references absolute http(s) URLs, distinct.
 * @param {unknown} value - Raw list
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string[]} - URLs in input order
 */
export const readReferences = (value: unknown, errors: ValidationIssue[]): string[] => {
  const urls = readProposalList(
    value,
    'references',
    LIMITS.references,
    (item, field) => {
      const url = readProposalText(item, field, { max: LIMITS.reference, required: true }, errors)

      if (url !== null && !isHttpUrl(url)) {
        errors.push({ field, code: 'invalid' })
        return null
      }

      return url
    },
    errors,
  )

  return [...new Set(urls)]
}
