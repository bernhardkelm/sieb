import type { ValidationIssue } from '#core/apiTypes.ts'
import {
  DECISION_STATUSES,
  JUSTIFIABLE_STATUS,
  type DecisionJustification,
  type DecisionStatus,
} from '#core/decision.ts'
import { defaultExpiresAt } from '#core/decisionExpiry.ts'
import { readExpiry, readJustification, readLiteral, readText } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'
import { isDecidableVerdict, statusOfVerdict, type ProposalClaims } from '#core/proposal.ts'
import { generateProposalReason } from '#core/proposalReason.ts'
import { isPlainObject } from '#core/proposalTextReaders.ts'
import type { ProposalValidated } from '#core/proposalValidation.ts'

/** Fields a reviewer may change before accepting, scope and images stay as proposed */
export const ACCEPT_EDIT_FIELDS = ['status', 'justification', 'reason', 'expiresAt'] as const

export type AcceptEditField = (typeof ACCEPT_EDIT_FIELDS)[number]

/** What the decisions of an accepted proposal get */
export interface AcceptedDecisionValues {
  status: DecisionStatus
  justification: DecisionJustification | null
  reason: string
  expiresAt: string | null
}

export interface AcceptPlan {
  values: AcceptedDecisionValues
  editedFields: AcceptEditField[] // edits that differ from the proposal
}

/**
 * Returns the decision values a proposal becomes with a status: its justification, the
 * generated reason, and its review date as the expiry while that lies ahead, else the default
 * expiry of the status.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {Date} now - Current time
 * @param {DecisionStatus} status - Status the decisions get
 * @returns {AcceptedDecisionValues} - Decision values
 */
const decisionValuesWith = (
  claims: ProposalClaims,
  now: Date,
  status: DecisionStatus,
): AcceptedDecisionValues => {
  const reviewDate = claims.review?.date ?? null

  return {
    status,
    justification: status === JUSTIFIABLE_STATUS ? claims.justification : null,
    reason: generateProposalReason(claims),
    expiresAt:
      reviewDate !== null && Date.parse(reviewDate) > now.getTime()
        ? reviewDate
        : defaultExpiresAt(status, now),
  }
}

/**
 * Returns the decision values a proposal becomes without edits, with the status of its verdict.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {Date} now - Current time
 * @returns {AcceptedDecisionValues | null} - Decision values, null for inconclusive, which
 * becomes a decision only with the status and reason the reviewer sets
 */
export const proposalDecisionValues = (
  claims: ProposalClaims,
  now: Date,
): AcceptedDecisionValues | null =>
  isDecidableVerdict(claims.verdict)
    ? decisionValuesWith(claims, now, statusOfVerdict(claims.verdict))
    : null

/**
 * Returns whether an accept has to be refused as not_acceptable: an inconclusive proposal
 * without a status edit, the verdict itself never becomes a decision.
 * @param {Pick<ProposalClaims, 'verdict'>} claims - Proposal verdict
 * @param {unknown} edits - Raw edits, absent for none
 * @returns {boolean} - True when the reviewer has not decided a status
 */
export const lacksReviewerStatus = (
  claims: Pick<ProposalClaims, 'verdict'>,
  edits: unknown,
): boolean =>
  !isDecidableVerdict(claims.verdict) && !(isPlainObject(edits) && edits.status !== undefined)

/**
 * Validates the edits of an accept and merges them over the proposal: status, justification
 * (only with not_affected, null clears it), reason and expiresAt (null for none) follow the
 * rules of a decision, any other field is not allowed. A status edit without an expiry edit
 * takes the expiry the proposal gives that status. An inconclusive proposal needs the status
 * and the reason as edits, every field set then counts as edited.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {unknown} edits - Raw edits, absent for none
 * @param {Date} now - Current time
 * @returns {ProposalValidated<AcceptPlan>} - Merged values with the edited fields, or the errors
 */
export const validateAcceptEdits = (
  claims: ProposalClaims,
  edits: unknown,
  now: Date,
): ProposalValidated<AcceptPlan> => {
  const raw = edits ?? {}

  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ field: 'edits', code: 'invalid' }] }
  }

  const errors: DecisionInputError[] = []
  const unknown: ValidationIssue[] = Object.keys(raw)
    .filter((key) => !(ACCEPT_EDIT_FIELDS as readonly string[]).includes(key))
    .map((key) => ({ field: `edits.${key}`, code: 'not_allowed' }))
  const proposed = proposalDecisionValues(claims, now)
  const status =
    raw.status === undefined && proposed !== null
      ? proposed.status
      : (readLiteral(raw.status, DECISION_STATUSES, 'status', errors) ?? proposed?.status)
  const justification = readJustification(raw.justification, status, errors)
  const expiresAt = readExpiry(raw.expiresAt, now, errors)
  const reason = raw.reason === undefined ? undefined : readText(raw.reason, 'reason', errors)

  if (proposed === null && raw.reason === undefined) {
    errors.push({ field: 'reason', code: 'required' })
  }

  if (status === undefined || errors.length > 0 || unknown.length > 0) {
    return {
      ok: false,
      errors: [...unknown, ...errors.map(({ field, code }) => ({ field: `edits.${field}`, code }))],
    }
  }

  const values = decisionValuesWith(claims, now, status)

  if (justification !== undefined) {
    values.justification = justification
  }

  if (reason !== undefined && reason !== null) {
    values.reason = reason
  }

  if (expiresAt !== undefined) {
    values.expiresAt = expiresAt
  }

  return {
    ok: true,
    value: {
      values,
      editedFields: ACCEPT_EDIT_FIELDS.filter(
        (field) =>
          raw[field] !== undefined && (proposed === null || values[field] !== proposed[field]),
      ),
    },
  }
}
