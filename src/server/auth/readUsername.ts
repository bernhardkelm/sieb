export const MAX_USERNAME_LENGTH = 256

const INVISIBLE_OR_CONTROL = /[\p{Cc}\p{Cf}]/u

/**
 * Reads an acting username from an identity claim, shared by the OIDC login and the OAuth
 * access tokens of /mcp: trimmed, 1 to MAX_USERNAME_LENGTH characters, no control or format
 * characters (newlines, zero-width and bidi marks), so the name in decisions and logs is the
 * name that was shown.
 * @param {unknown} raw - Claim value, usually preferred_username
 * @returns {string | null} - Username, null when missing or refused
 */
export const readUsername = (raw: unknown): string | null => {
  const username = typeof raw === 'string' ? raw.trim() : ''

  if (
    username === '' ||
    username.length > MAX_USERNAME_LENGTH ||
    INVISIBLE_OR_CONTROL.test(username)
  ) {
    return null
  }

  return username
}
