import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { errorCodeMessage } from '@/format/labels'

const FORM_FIELDS = ['status', 'justification', 'reason', 'expiresAt', 'waitingFor'] as const

export type FormField = (typeof FORM_FIELDS)[number]

/** Messages per form field plus those about the whole input */
export type DecisionFormErrors = Record<FormField | 'general', string[]>

/**
 * Sorts the error of a failed save into messages per form field. Validation errors of fields
 * the form does not show and every other failure become general messages.
 * @param {unknown} error - Thrown value, null without an error
 * @returns {DecisionFormErrors} - Messages per field
 */
export const decisionFormErrors = (error: unknown): DecisionFormErrors => {
  const errors: DecisionFormErrors = {
    status: [],
    justification: [],
    reason: [],
    expiresAt: [],
    waitingFor: [],
    general: [],
  }

  if (error === null || error === undefined) {
    return errors
  }

  if (!(error instanceof ApiError)) {
    errors.general.push(errorMessage(error))
    return errors
  }

  if (!error.isValidation) {
    errors.general.push(errorMessage(error))
    return errors
  }

  for (const issue of error.errors) {
    const field = (FORM_FIELDS as readonly (string | null)[]).includes(issue.field)
      ? (issue.field as FormField)
      : 'general'
    const message = errorCodeMessage(issue.code)

    errors[field].push(field === 'general' && issue.field ? `${issue.field}: ${message}` : message)
  }

  return errors
}

/** Messages of the checks the form runs before it submits */
export type LocalFormErrors = Record<'status' | 'reason' | 'expiresAt' | 'waitingFor', string[]>

export interface LocalFormInput {
  status: string | null
  reason: string
  never: boolean
  expiresAt: string | null // null for an empty or unreadable date
  upstreamPending: boolean // checked with status fix_planned
  waitingFor: string
}

/**
 * Returns the message of a missing expiry: a review date while waiting for upstream, else a
 * date or never.
 * @param {LocalFormInput} input - Current input
 * @returns {string[]} - Message, empty when the expiry passes
 */
const expiryErrors = (input: LocalFormInput): string[] => {
  if (input.upstreamPending && (input.never || input.expiresAt === null)) {
    return ['Waiting for upstream needs a review date.']
  }

  return !input.never && input.expiresAt === null ? ['Pick a date or choose never.'] : []
}

/**
 * Checks the input before it is submitted: a status is chosen, the reason is not blank, a date
 * is set unless the decision never expires, and waiting for upstream names what it waits for
 * and has a review date.
 * @param {LocalFormInput} input - Current input
 * @returns {LocalFormErrors} - Messages per field, empty lists when the input passes
 */
export const localFormErrors = (input: LocalFormInput): LocalFormErrors => ({
  status: input.status === null ? ['Choose a status.'] : [],
  reason: input.reason.trim() === '' ? ['A reason is required.'] : [],
  expiresAt: expiryErrors(input),
  waitingFor:
    input.upstreamPending && input.waitingFor.trim() === '' ? ['Name what you wait for.'] : [],
})

/**
 * Returns whether any field carries a message.
 * @param {LocalFormErrors} errors - Messages per field
 * @returns {boolean} - True when the input must not be submitted
 */
export const hasLocalErrors = (errors: LocalFormErrors): boolean =>
  Object.values(errors).some((messages) => messages.length > 0)
