/**
 * Returns the message of a caught value.
 * @param {unknown} error - Caught value
 * @returns {string} - Error message, or the value as text
 */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
