import type { ValidationIssue } from '#core/errorApiTypes.ts'
import type { DecisionJustification } from '#core/decision.ts'
import { readJustification } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'
import {
  INCONCLUSIVE_VERDICT,
  isDecidableVerdict,
  PROPOSAL_LIMITS as LIMITS,
  statusOfVerdict,
  type ProposalVerdict,
} from '#core/proposal.ts'
import { readProposalList, readProposalText } from '#core/proposalTextReaders.ts'

/**
 * Reads the justification: required with verdict not_affected, not allowed with the others.
 * @param {unknown} value - Raw justification
 * @param {ProposalVerdict | null} verdict - Validated verdict
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {DecisionJustification | null} - Justification
 */
export const readProposalJustification = (
  value: unknown,
  verdict: ProposalVerdict | null,
  errors: ValidationIssue[],
): DecisionJustification | null => {
  if (verdict === INCONCLUSIVE_VERDICT && value !== undefined && value !== null) {
    errors.push({ field: 'justification', code: 'not_allowed' })
    return null
  }

  const decisionErrors: DecisionInputError[] = []
  const justification = readJustification(
    value,
    verdict === null || !isDecidableVerdict(verdict) ? null : statusOfVerdict(verdict),
    decisionErrors,
  )

  errors.push(...decisionErrors)

  if (verdict === 'not_affected' && (justification === undefined || justification === null)) {
    if (decisionErrors.length === 0) {
      errors.push({ field: 'justification', code: 'required' })
    }

    return null
  }

  return justification ?? null
}

/**
 * Reads what is missing to decide: with verdict inconclusive 1 to PROPOSAL_LIMITS.missingItems
 * entries, each capped like an unknown; any other verdict must leave it absent or empty.
 * @param {unknown} value - Raw list
 * @param {ProposalVerdict | null} verdict - Validated verdict
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string[]} - Entries, empty for other verdicts or on errors
 */
export const readMissing = (
  value: unknown,
  verdict: ProposalVerdict | null,
  errors: ValidationIssue[],
): string[] => {
  const missing = readProposalList(
    value,
    'missing',
    LIMITS.missingItems,
    (item, field) =>
      readProposalText(item, field, { max: LIMITS.missing, multiline: true }, errors),
    errors,
  )

  if (verdict === null || errors.some((e) => e.field?.startsWith('missing'))) {
    return []
  }

  if (verdict !== INCONCLUSIVE_VERDICT) {
    if (missing.length > 0) {
      errors.push({ field: 'missing', code: 'not_allowed' })
    }

    return []
  }

  if (missing.length === 0) {
    errors.push({ field: 'missing', code: 'required' })
  }

  return missing
}
