import type { ValidationIssue } from '#core/errorApiTypes.ts'
import { DECISION_STATUSES } from '#core/decision.ts'
import { readExpiry, readJustification, readLiteral, readText } from '#core/decisionFieldReaders.ts'
import type { DecisionInputError } from '#core/decisionInputError.ts'
import { mergeUpstream, readUpstreamPatch } from '#core/decisionUpstream.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import {
  ACCEPT_EDIT_FIELDS,
  decisionValuesWith,
  proposalDecisionValues,
  type AcceptPlan,
} from '#core/proposalAccept.ts'
import type { ProposalClaims } from '#core/proposalRecord.ts'
import type { Validation } from '#core/validation.ts'

/**
 * Validates the edits of an accept and merges them over the proposal: status, justification
 * (only with not_affected, null clears it), reason, expiresAt (null for none), upstreamPending
 * and waitingFor follow the rules of a decision, also on the merged values, any other field is
 * not allowed. A status edit without an expiry edit takes the expiry the proposal gives that
 * status. An inconclusive proposal needs the status and the reason as edits, every field set
 * then counts as edited.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {unknown} edits - Raw edits, absent for none
 * @param {Date} now - Current time
 * @returns {Validation<AcceptPlan>} - Merged values with the edited fields, or the errors
 */
export const validateAcceptEdits = (
  claims: ProposalClaims,
  edits: unknown,
  now: Date,
): Validation<AcceptPlan> => {
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
  const upstreamEdits = readUpstreamPatch(raw, errors)

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

  const upstream = mergeUpstream(values, upstreamEdits, values)

  if (!upstream.ok) {
    return {
      ok: false,
      errors: [{ field: `edits.${upstream.issue.field}`, code: upstream.issue.code }],
    }
  }

  Object.assign(values, upstream.value)

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
