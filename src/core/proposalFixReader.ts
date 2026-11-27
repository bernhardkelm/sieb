import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { PATCH_LAYERS, PROPOSAL_LIMITS as LIMITS, type ProposalFix } from '#core/proposal.ts'
import { readFixUpstream } from '#core/proposalFixUpstream.ts'
import { readProposalEnum, readProposalText } from '#core/proposalTextReaders.ts'

/**
 * Reads the fix path: the one-line patch action with its layer, fixed version, what to change,
 * rough effort, availability, what an upstream_pending fix waits for and an interim workaround,
 * each optional here; applyFixAvailability adds the verdict rules.
 * @param {unknown} value - Raw fix
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalFix | null} - Fix, null when absent, empty or invalid
 */
export const readFix = (value: unknown, errors: ValidationIssue[]): ProposalFix | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (!isPlainObject(value)) {
    errors.push({ field: 'fix', code: 'invalid' })
    return null
  }

  const fix: ProposalFix = {
    action: readProposalText(value.action, 'fix.action', { max: LIMITS.fixAction }, errors),
    layer:
      value.layer === undefined || value.layer === null
        ? null
        : readProposalEnum(value.layer, PATCH_LAYERS, 'fix.layer', errors),
    fixedVersion: readProposalText(
      value.fixedVersion,
      'fix.fixedVersion',
      { max: LIMITS.fixVersion },
      errors,
    ),
    change: readProposalText(
      value.change,
      'fix.change',
      { max: LIMITS.fixChange, multiline: true },
      errors,
    ),
    effort: readProposalText(value.effort, 'fix.effort', { max: LIMITS.fixEffort }, errors),
    ...readFixUpstream(value, errors),
  }

  return Object.values(fix).every((part) => part === null) ? null : fix
}
