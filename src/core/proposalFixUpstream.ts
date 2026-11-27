import type { ValidationIssue } from '#core/apiTypes.ts'
import {
  FIX_AVAILABILITIES,
  PROPOSAL_LIMITS as LIMITS,
  type FixAvailability,
  type ProposalFix,
  type ProposalInterim,
  type ProposalReview,
  type ProposalVerdict,
} from '#core/proposal.ts'
import { isPlainObject, readProposalEnum, readProposalText } from '#core/proposalTextReaders.ts'

type FixUpstream = Pick<ProposalFix, 'availability' | 'waitingFor' | 'interim'>

/**
 * Returns whether a proposal plans a fix that waits for an upstream release.
 * @param {{ verdict: ProposalVerdict; fix: ProposalFix | null }} claims - Verdict and fix path
 * @returns {boolean} - True for fix_planned with availability upstream_pending
 */
export const isUpstreamPendingFix = (claims: {
  verdict: ProposalVerdict
  fix: ProposalFix | null
}): boolean => claims.verdict === 'fix_planned' && claims.fix?.availability === 'upstream_pending'

/**
 * Reads the interim workaround: the one-line action and the caveats required, steps optional.
 * @param {unknown} value - Raw interim
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalInterim | null} - Interim, null when absent or invalid
 */
const readInterim = (value: unknown, errors: ValidationIssue[]): ProposalInterim | null => {
  if (value === undefined || value === null) {
    return null
  }

  if (!isPlainObject(value)) {
    errors.push({ field: 'fix.interim', code: 'invalid' })
    return null
  }

  const action = readProposalText(
    value.action,
    'fix.interim.action',
    { max: LIMITS.interimAction, required: true },
    errors,
  )
  const steps = readProposalText(
    value.steps,
    'fix.interim.steps',
    { max: LIMITS.interimSteps, multiline: true },
    errors,
  )
  const caveats = readProposalText(
    value.caveats,
    'fix.interim.caveats',
    { max: LIMITS.interimCaveats, multiline: true, required: true },
    errors,
  )

  return action === null || caveats === null ? null : { action, steps, caveats }
}

/**
 * Reads the availability, waitingFor and interim of a raw fix, without the verdict rules.
 * @param {Record<string, unknown>} value - Raw fix object
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {FixUpstream} - Parts, null where absent or invalid
 */
export const readFixUpstream = (
  value: Record<string, unknown>,
  errors: ValidationIssue[],
): FixUpstream => ({
  availability:
    value.availability === undefined || value.availability === null
      ? null
      : readProposalEnum(value.availability, FIX_AVAILABILITIES, 'fix.availability', errors),
  waitingFor: readProposalText(
    value.waitingFor,
    'fix.waitingFor',
    { max: LIMITS.waitingFor },
    errors,
  ),
  interim: readInterim(value.interim, errors),
})

/**
 * Returns the availability a verdict allows: needs_patch only available, fix_planned either,
 * the other verdicts none.
 * @param {ProposalVerdict} verdict - Validated verdict
 * @returns {readonly FixAvailability[]} - Allowed values, empty when the fix must carry none
 */
const allowedAvailability = (verdict: ProposalVerdict): readonly FixAvailability[] => {
  if (verdict === 'fix_planned') {
    return FIX_AVAILABILITIES
  }

  return verdict === 'needs_patch' ? ['available'] : []
}

/**
 * Applies the verdict rules to the availability of a fix. needs_patch is available, absent
 * meaning so; fix_planned must state it, upstream_pending with waitingFor and a review date;
 * waitingFor and interim go only with upstream_pending; other verdicts carry none of the three.
 * @param {ProposalFix | null} fix - Read fix
 * @param {ProposalVerdict | null} verdict - Validated verdict, null skips the rules
 * @param {ProposalReview | null} review - Read review
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {ProposalFix | null} - Fix, needs_patch with availability available
 */
export const applyFixAvailability = (
  fix: ProposalFix | null,
  verdict: ProposalVerdict | null,
  review: ProposalReview | null,
  errors: ValidationIssue[],
): ProposalFix | null => {
  if (verdict === null || errors.some((e) => e.field === 'fix.availability')) {
    return fix
  }

  const allowed = allowedAvailability(verdict)
  const availability = fix?.availability ?? null

  if (availability !== null && !allowed.includes(availability)) {
    errors.push({ field: 'fix.availability', code: 'not_allowed' })
  } else if (availability === null && verdict === 'fix_planned') {
    errors.push({ field: 'fix.availability', code: 'required' })
  }

  const pending = availability === 'upstream_pending' && allowed.includes(availability)

  if (fix?.waitingFor && !pending) {
    errors.push({ field: 'fix.waitingFor', code: 'not_allowed' })
  }

  if (fix?.interim && !pending) {
    errors.push({ field: 'fix.interim', code: 'not_allowed' })
  }

  if (pending && !fix?.waitingFor && !errors.some((e) => e.field === 'fix.waitingFor')) {
    errors.push({ field: 'fix.waitingFor', code: 'required' })
  }

  if (pending && !review?.date && !errors.some((e) => e.field === 'review.date')) {
    errors.push({ field: 'review.date', code: 'required' })
  }

  return fix !== null && verdict === 'needs_patch' ? { ...fix, availability: 'available' } : fix
}
