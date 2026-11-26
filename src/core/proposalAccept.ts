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
import { statusOfVerdict, type ProposalClaims } from '#core/proposal.ts'
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
 * Returns the decision values a proposal becomes without edits: the status of its verdict, its
 * justification, the generated reason, and its review date as the expiry while that lies ahead,
 * else the default expiry of the status.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {Date} now - Current time
 * @param {DecisionStatus} status - Status to compute the expiry for, the verdict's by default
 * @returns {AcceptedDecisionValues} - Decision values
 */
export const proposalDecisionValues = (
  claims: ProposalClaims,
  now: Date,
  status: DecisionStatus = statusOfVerdict(claims.verdict),
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
 * Validates the edits of an accept and merges them over the proposal: status, justification
 * (only with not_affected, null clears it), reason and expiresAt (null for none) follow the
 * rules of a decision, any other field is not allowed. A status edit without an expiry edit
 * takes the expiry the proposal gives that status.
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
    raw.status === undefined
      ? proposed.status
      : (readLiteral(raw.status, DECISION_STATUSES, 'status', errors) ?? proposed.status)
  const values = proposalDecisionValues(claims, now, status)
  const justification = readJustification(raw.justification, status, errors)
  const expiresAt = readExpiry(raw.expiresAt, now, errors)

  if (justification !== undefined) {
    values.justification = justification
  }

  if (raw.reason !== undefined) {
    values.reason = readText(raw.reason, 'reason', errors) ?? values.reason
  }

  if (expiresAt !== undefined) {
    values.expiresAt = expiresAt
  }

  if (errors.length > 0 || unknown.length > 0) {
    return {
      ok: false,
      errors: [...unknown, ...errors.map(({ field, code }) => ({ field: `edits.${field}`, code }))],
    }
  }

  return {
    ok: true,
    value: {
      values,
      editedFields: ACCEPT_EDIT_FIELDS.filter(
        (field) => raw[field] !== undefined && values[field] !== proposed[field],
      ),
    },
  }
}
