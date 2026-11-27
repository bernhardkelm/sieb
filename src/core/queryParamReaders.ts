import type { ValidationIssue } from '#core/errorApiTypes.ts'

export const NAME_PATTERN_MAX_LENGTH = 256

/**
 * Splits a comma separated parameter into trimmed, non-empty entries.
 * @param {string | undefined} raw - Parameter value
 * @returns {string[]} - Entries, empty when absent
 */
const splitEntries = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')

/**
 * Splits a comma separated parameter and checks every entry against the allowed values.
 * @param {string | undefined} raw - Parameter value
 * @param {(value: unknown) => value is T} guard - Type guard of the allowed values
 * @param {string} field - Parameter name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {T[]} - Valid entries, empty when absent
 */
export const readList = <T extends string>(
  raw: string | undefined,
  guard: (value: unknown) => value is T,
  field: string,
  errors: ValidationIssue[],
): T[] => {
  const entries = splitEntries(raw)

  if (!entries.every(guard)) {
    errors.push({ field, code: 'invalid' })
    return []
  }

  return entries
}

/**
 * Reads a comma separated list of name patterns, each at most NAME_PATTERN_MAX_LENGTH
 * characters.
 * @param {string | undefined} raw - Parameter value
 * @param {string} field - Parameter name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string[]} - Patterns, empty when absent
 */
export const readNamePatterns = (
  raw: string | undefined,
  field: string,
  errors: ValidationIssue[],
): string[] =>
  readList(
    raw,
    (value): value is string =>
      typeof value === 'string' && value.length <= NAME_PATTERN_MAX_LENGTH,
    field,
    errors,
  )

/**
 * Reads a number within a range.
 * @param {string | undefined} raw - Parameter value
 * @param {{ min: number; max: number }} range - Inclusive bounds
 * @param {string} field - Parameter name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {number | null} - Number, null when absent or invalid
 */
export const readNumber = (
  raw: string | undefined,
  range: { min: number; max: number },
  field: string,
  errors: ValidationIssue[],
): number | null => {
  if (raw === undefined || raw.trim() === '') {
    return null
  }

  const value = Number(raw)

  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    errors.push({ field, code: 'invalid' })
    return null
  }

  return value
}

/**
 * Reads any parseable timestamp as an ISO timestamp.
 * @param {string | undefined} raw - Parameter value
 * @param {string} field - Parameter name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {string | null} - ISO timestamp, null when absent or invalid
 */
export const readTimestamp = (
  raw: string | undefined,
  field: string,
  errors: ValidationIssue[],
): string | null => {
  if (!raw) {
    return null
  }

  const time = Date.parse(raw)

  if (Number.isNaN(time)) {
    errors.push({ field, code: 'invalid' })
    return null
  }

  return new Date(time).toISOString()
}

/**
 * Reads an optional boolean: true or 1, false or 0.
 * @param {string | undefined} raw - Parameter value
 * @param {string} field - Parameter name for the error
 * @param {ValidationIssue[]} errors - Collected errors, appended to
 * @returns {boolean | null} - Boolean, null when absent or invalid
 */
export const readOptionalBoolean = (
  raw: string | undefined,
  field: string,
  errors: ValidationIssue[],
): boolean | null => {
  if (raw === undefined || raw === '') {
    return null
  }

  if (raw === 'true' || raw === '1') {
    return true
  }

  if (raw === 'false' || raw === '0') {
    return false
  }

  errors.push({ field, code: 'invalid' })
  return null
}
