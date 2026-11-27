import type { DecisionPatchRequest } from '#core/apiTypes.ts'
import { JUSTIFIABLE_STATUS, type Decision } from '#core/decision.ts'
import {
  isLapsed,
  toDateInput,
  type DecisionFormValue,
} from '@/components/decision/decisionFormModel'

/**
 * Returns whether a submitted expiry names the same day as the stored one, in local time like
 * the date input, so an untouched round trip through the input keeps the stored instant.
 * @param {string | null} stored - Stored expiry
 * @param {string | null} submitted - Submitted expiry
 * @returns {boolean} - True for the same day or both without expiry
 */
const sameExpiryDay = (stored: string | null, submitted: string | null): boolean =>
  stored === null || submitted === null
    ? stored === submitted
    : toDateInput(stored) === toDateInput(submitted)

/**
 * Returns the expiry a patch must carry. An untouched expiry is left out, so the server keeps it
 * or applies the default of a changed status; a lapsed one is replaced by the date the form
 * shows, so saving revives the decision; a date picked back to the stored day keeps the stored
 * instant.
 * @param {Decision} decision - Stored decision
 * @param {DecisionFormValue} value - Submitted form values
 * @param {Date} now - Current time
 * @returns {string | null | undefined} - Expiry to send, undefined to leave it out
 */
const patchExpiry = (
  decision: Decision,
  value: DecisionFormValue,
  now: Date,
): string | null | undefined => {
  if (isLapsed(decision.expiresAt, now)) {
    return value.expiresAt
  }

  if (!value.expiryTouched) {
    return undefined
  }

  if (!sameExpiryDay(decision.expiresAt, value.expiresAt)) {
    return value.expiresAt
  }

  return value.status === decision.status ? undefined : decision.expiresAt
}

/**
 * Builds the change of an existing decision from the form, with only the fields that changed.
 * The justification is sent only while the status is not_affected; a status leaving it lets the
 * server clear the justification and the upstream fields, which go along when they changed.
 * @param {Decision} decision - Stored decision
 * @param {DecisionFormValue} value - Submitted form values
 * @param {Date} now - Current time
 * @returns {DecisionPatchRequest} - Patch, empty when nothing changed
 */
export const decisionPatch = (
  decision: Decision,
  value: DecisionFormValue,
  now: Date,
): DecisionPatchRequest => {
  const patch: DecisionPatchRequest = {}
  const expiresAt = patchExpiry(decision, value, now)

  if (value.status !== decision.status) {
    patch.status = value.status
  }

  if (value.status === JUSTIFIABLE_STATUS && value.justification !== decision.justification) {
    patch.justification = value.justification
  }

  if (value.reason !== decision.reason) {
    patch.reason = value.reason
  }

  if (value.upstreamPending !== decision.upstreamPending) {
    patch.upstreamPending = value.upstreamPending
  }

  if (value.upstreamPending && value.waitingFor !== decision.waitingFor) {
    patch.waitingFor = value.waitingFor
  }

  if (expiresAt !== undefined) {
    patch.expiresAt = expiresAt
  }

  if (value.reconfirm) {
    patch.reconfirm = true
  }

  return patch
}
