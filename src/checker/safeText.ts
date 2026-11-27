/**
 * Returns whether a UTF-16 code unit is a C0, DEL or C1 control character.
 * @param {number} code - Code unit
 * @returns {boolean} - Whether it controls a terminal or a log line
 */
const isControl = (code: number): boolean => code < 0x20 || (code >= 0x7f && code <= 0x9f)

/**
 * Replaces control characters with spaces, so untrusted text such as a reply, a registry error or
 * a tool's stderr cannot forge log lines or terminal sequences.
 * @param {string} text - Untrusted text
 * @returns {string} - Text without C0, DEL and C1 control characters
 */
export const printable = (text: string): string =>
  Array.from(text, (char) => (isControl(char.charCodeAt(0)) ? ' ' : char)).join('')

/**
 * Returns the message of a caught value.
 * @param {unknown} error - Caught value
 * @returns {string} - Error message, or the value as text
 */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
