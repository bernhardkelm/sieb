import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { errorCodeMessage } from '@/format/labels'

const FORM_FIELDS = ['status', 'reason', 'expiresAt'] as const

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
  const errors: DecisionFormErrors = { status: [], reason: [], expiresAt: [], general: [] }

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
