/**
 * Returns a value as a plain object.
 * @param {unknown} value - Parsed JSON
 * @returns {Record<string, unknown>} - Object, empty for anything else
 */
export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/**
 * Returns a value as an array.
 * @param {unknown} value - Parsed JSON
 * @returns {unknown[]} - Array, empty for anything else
 */
export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * Returns a value as a non-empty string.
 * @param {unknown} value - Parsed JSON
 * @returns {string | null} - String, null for empty strings and other types
 */
export const asText = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

/**
 * Returns a value as a finite number, parsing numeric strings.
 * @param {unknown} value - Parsed JSON or label value
 * @returns {number | null} - Number, null when missing or not numeric
 */
export const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value

  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u

/**
 * Returns a value as a non-empty plain string of bounded length, for scanner values that are
 * shown and stored as is.
 * @param {unknown} value - Parsed JSON
 * @param {number} maxLength - Longest accepted length
 * @returns {string | null} - String, null when missing, too long or with control characters
 */
export const asPlainText = (value: unknown, maxLength: number): string | null => {
  const text = asText(value)

  return text !== null && text.length <= maxLength && !CONTROL_OR_FORMAT.test(text) ? text : null
}
