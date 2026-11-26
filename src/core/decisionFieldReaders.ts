import { MAX_EXPIRY_DAYS } from '#core/decisionExpiry.ts'
import type { DecisionField, DecisionInputError } from '#core/decisionInputError.ts'
import { parseExpiry } from '#core/expiryParsing.ts'

export const MAX_REASON_LENGTH = 2000

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Returns a trimmed non-empty string or null.
 * @param {unknown} value - Raw value
 * @returns {string | null} - Trimmed string, null for non-strings and blank strings
 */
export const nonBlank = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/**
 * Validates an expiry: absent stays undefined, null means no expiry, otherwise an ISO 8601
 * date-time with Z or an offset, or a date as the end of that day in UTC, after now and at most
 * MAX_EXPIRY_DAYS ahead, normalised to ISO in UTC.
 * @param {unknown} value - Raw expiresAt
 * @param {Date} now - Current time
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {string | null | undefined} - Normalised value
 */
export const readExpiry = (
  value: unknown,
  now: Date,
  errors: DecisionInputError[],
): string | null | undefined => {
  if (value === undefined || value === null) {
    return value
  }

  const time = typeof value === 'string' ? parseExpiry(value) : null

  if (time === null) {
    errors.push({ field: 'expiresAt', code: 'invalid' })
    return undefined
  }

  if (time <= now.getTime()) {
    errors.push({ field: 'expiresAt', code: 'in_past' })
    return undefined
  }

  if (time > now.getTime() + MAX_EXPIRY_DAYS * DAY_MS) {
    errors.push({ field: 'expiresAt', code: 'too_far' })
    return undefined
  }

  return new Date(time).toISOString()
}

/**
 * Reads a free text field: trimmed, not blank and at most MAX_REASON_LENGTH characters.
 * @param {unknown} value - Raw value
 * @param {DecisionField} field - Field name for the error
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {string | null} - Trimmed text, null when missing, blank or too long
 */
export const readText = (
  value: unknown,
  field: DecisionField,
  errors: DecisionInputError[],
): string | null => {
  const text = nonBlank(value)

  if (text === null) {
    errors.push({ field, code: 'required' })
    return null
  }

  if (text.length > MAX_REASON_LENGTH) {
    errors.push({ field, code: 'too_long' })
    return null
  }

  return text
}

/**
 * Reads a value from a list of allowed literals.
 * @param {unknown} value - Raw value
 * @param {readonly T[]} allowed - Allowed literals
 * @param {DecisionField} field - Field name for the error
 * @param {DecisionInputError[]} errors - Collected errors, appended to
 * @returns {T | null} - Literal, null when missing or invalid
 */
export const readLiteral = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: DecisionField,
  errors: DecisionInputError[],
): T | null => {
  if ((allowed as readonly unknown[]).includes(value)) {
    return value as T
  }

  errors.push({ field, code: value === undefined ? 'required' : 'invalid' })
  return null
}
