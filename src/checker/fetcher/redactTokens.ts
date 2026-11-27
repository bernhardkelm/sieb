const MASK = '[redacted]'

// a credential value holds at least one digit or symbol, so words such as "authentication" stay
const TOKEN = String.raw`(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{8,}`

const PATTERNS: [RegExp, string][] = [
  [/\b((?:proxy-)?authorization"?\s*[:=]\s*"?)[^\r\n",}]+/giu, `$1${MASK}`],
  [new RegExp(String.raw`\b(bearer|basic)\s+${TOKEN}`, 'giu'), `$1 ${MASK}`],
  [/("(?:token|access_token|refresh_token|id_token)"\s*:\s*")[^"]*/giu, `$1${MASK}`],
  [/\b(https?:\/\/)[^\s/@]+@/giu, `$1${MASK}@`],
  [
    /([?&][^\s=&#]*(?:token|signature|sig|secret|password|credential)[^\s=&#]*=)[^\s&#"']+/giu,
    `$1${MASK}`,
  ],
]

/**
 * Masks credential shapes crane, git or syft may print, whoever issued them: Authorization
 * header values, Bearer and Basic credentials, token fields of a token answer, userinfo of URLs
 * and token or signature query parameters, as in a registry's signed blob redirect.
 * @param {string} text - Log line or error text
 * @returns {string} - Text with those values replaced by [redacted]
 */
export const redactTokens = (text: string): string =>
  PATTERNS.reduce((clean, [pattern, replacement]) => clean.replace(pattern, replacement), text)
