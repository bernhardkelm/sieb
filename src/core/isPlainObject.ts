/**
 * Returns whether a value is a plain object.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for a non-null, non-array object
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
