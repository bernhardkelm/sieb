import type { ProposalAcceptRequest } from '#core/apiTypes.ts'
import { JUSTIFIABLE_STATUS } from '#core/decision.ts'
import type { AcceptedDecisionValues } from '#core/proposalAccept.ts'
import { ApiError } from '@/api/ApiError'
import type {
  DecisionFormInitial,
  DecisionFormValue,
} from '@/components/decision/decisionFormModel'

type AcceptEdits = NonNullable<ProposalAcceptRequest['edits']>

const EDITS_PREFIX = 'edits.'

/**
 * Returns the starting values of the decision form for Edit & accept, the values accepting
 * without edits writes; Decide myself on an inconclusive proposal starts without a status.
 * @param {AcceptedDecisionValues | null} values - Decision values of the proposal detail
 * @returns {DecisionFormInitial} - Form values, scope image since the form offers no scope
 */
export const editInitial = (values: AcceptedDecisionValues | null): DecisionFormInitial =>
  values === null
    ? { scope: 'image' }
    : {
        status: values.status,
        justification: values.justification,
        reason: values.reason,
        scope: 'image',
        expiresAt: values.expiresAt,
      }

/**
 * Returns the edits of an accept: the fields the reviewer changed against the proposed values,
 * status and reason always for an inconclusive proposal, which proposes none. An untouched
 * expiry is left out, so the server applies the expiry the proposal gives the chosen status;
 * the justification goes along only with not_affected.
 * @param {AcceptedDecisionValues | null} proposed - Values accepting without edits writes
 * @param {DecisionFormValue} value - Submitted form values
 * @returns {AcceptEdits} - Changed fields, empty when nothing changed
 */
export const acceptEdits = (
  proposed: AcceptedDecisionValues | null,
  value: DecisionFormValue,
): AcceptEdits => {
  const edits: AcceptEdits = {}

  if (value.status !== proposed?.status) {
    edits.status = value.status
  }

  if (value.status === JUSTIFIABLE_STATUS && value.justification !== proposed?.justification) {
    edits.justification = value.justification
  }

  if (value.reason !== proposed?.reason.trim()) {
    edits.reason = value.reason
  }

  if (value.expiryTouched) {
    edits.expiresAt = value.expiresAt
  }

  return edits
}

/**
 * Returns an accept failure with the edits.<field> validation errors renamed to the form fields,
 * so the decision form shows them next to its inputs.
 * @param {unknown} error - Thrown value
 * @returns {unknown} - Same value, or a copy of the ApiError with plain field names
 */
export const formErrorOfAccept = (error: unknown): unknown => {
  if (!(error instanceof ApiError) || !error.isValidation) {
    return error
  }

  return new ApiError(
    error.status,
    {
      error: error.code,
      errors: error.errors.map((issue) => ({
        field: issue.field?.startsWith(EDITS_PREFIX)
          ? issue.field.slice(EDITS_PREFIX.length)
          : issue.field,
        code: issue.code,
      })),
    },
    'accept',
  )
}
