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
