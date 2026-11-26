import { MAX_TOKEN_NAME_LENGTH } from '#core/apiToken.ts'
import { ApiError } from '@/api/ApiError'
import { errorMessage } from '@/api/apiRequest'
import { errorCodeMessage } from '@/format/labels'

const TOKEN_FIELDS = ['name', 'scope', 'expiresAt'] as const

export type TokenField = (typeof TOKEN_FIELDS)[number]

/** Messages per form field plus those about the whole input */
export type TokenFormErrors = Record<TokenField | 'general', string[]>

const NAME_MESSAGES: Record<string, string> = {
  required: 'A name is required.',
  too_long: `At most ${MAX_TOKEN_NAME_LENGTH} characters.`,
}

/**
 * Returns empty messages for every field.
 * @returns {TokenFormErrors} - No messages
 */
export const noTokenFormErrors = (): TokenFormErrors => ({
  name: [],
  scope: [],
  expiresAt: [],
  general: [],
})

/**
 * Sorts the error of a failed token creation into messages per form field, every other failure
 * becomes a general message.
 * @param {unknown} error - Thrown value
 * @returns {TokenFormErrors} - Messages per field
 */
export const tokenFormErrors = (error: unknown): TokenFormErrors => {
  const errors = noTokenFormErrors()

  if (!(error instanceof ApiError) || !error.isValidation) {
    errors.general.push(errorMessage(error))
    return errors
  }

  for (const issue of error.errors) {
    const field = (TOKEN_FIELDS as readonly (string | null)[]).includes(issue.field)
      ? (issue.field as TokenField)
      : 'general'
    const message =
      (field === 'name' ? NAME_MESSAGES[issue.code] : undefined) ?? errorCodeMessage(issue.code)

    errors[field].push(message)
  }

  return errors
}

/**
 * Checks a token name before it is submitted.
 * @param {string} name - Typed name
 * @returns {string[]} - Messages, empty when the name passes
 */
export const localNameErrors = (name: string): string[] => {
  const trimmed = name.trim()

  if (trimmed === '') {
    return [NAME_MESSAGES.required!]
  }

  return trimmed.length > MAX_TOKEN_NAME_LENGTH ? [NAME_MESSAGES.too_long!] : []
}
