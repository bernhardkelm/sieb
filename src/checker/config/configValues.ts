/**
 * Reads a required, non-blank variable.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string} name - Variable name
 * @returns {string} - Trimmed value
 * @throws {Error} - When the variable is unset or blank
 */
export const required = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

/**
 * Parses an integer variable within bounds.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @param {number} fallback - Value when unset or blank
 * @param {number} max - Largest accepted value
 * @returns {number} - Parsed integer
 * @throws {Error} - When the value is not an integer between 1 and max
 */
export const boundedInt = (
  value: string | undefined,
  name: string,
  fallback: number,
  max: number = Number.MAX_SAFE_INTEGER,
): number => {
  const parsed = value?.trim() ? Number(value) : fallback

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer from 1 to ${max}, got "${value}"`)
  }

  return parsed
}

/**
 * Validates the worker API base URL.
 * @param {string} value - Raw SIEB_WORKER_URL
 * @returns {string} - URL without trailing slash
 * @throws {Error} - When it is not an http or https URL
 */
export const workerUrl = (value: string): string => {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`SIEB_WORKER_URL must be an http or https URL, got "${value}"`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`SIEB_WORKER_URL must be an http or https URL, got "${value}"`)
  }

  return value.replace(/\/+$/, '')
}
