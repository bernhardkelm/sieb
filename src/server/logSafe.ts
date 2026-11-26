const MAX_LOG_TEXT_LENGTH = 200

/**
 * Makes untrusted text safe for a single log line: control characters become spaces and the
 * text is capped, so an issuer or a request cannot forge or flood log lines.
 * @param {string} text - Untrusted text
 * @returns {string} - Text for the log
 */
export const logSafe = (text: string): string =>
  Array.from(text.slice(0, MAX_LOG_TEXT_LENGTH))
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 0x20 || code === 0x7f ? ' ' : char
    })
    .join('')

/**
 * Returns the message of a caught value for the log, with the error code and the message of its
 * cause, where openid-client names the failed check; its messages carry no tokens.
 * @param {unknown} error - Caught value
 * @returns {string} - Log-safe message
 */
export const errorText = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return logSafe(String(error))
  }

  const { code, cause } = error as { code?: unknown; cause?: unknown }
  const details = [
    typeof code === 'string' ? code : null,
    cause instanceof Error ? cause.message : null,
  ].filter((detail) => detail !== null)

  return logSafe(details.length === 0 ? error.message : `${error.message} (${details.join(', ')})`)
}
