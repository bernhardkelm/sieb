/**
 * Parses a positive integer path parameter.
 * @param {string} value - Raw parameter
 * @returns {number | null} - Id, null when malformed
 */
export const parseId = (value: string): number | null =>
  /^[1-9]\d*$/.test(value) ? Number(value) : null
