import type { ApiToken } from '#core/apiToken.ts'

/**
 * Formats the log line of a token change, never with the secret.
 * @param {string} change - What happened
 * @param {ApiToken} token - Token
 * @returns {string} - Log line
 */
export const tokenLogLine = (change: string, token: ApiToken): string =>
  `[sieb] api token ${change}: owner=${JSON.stringify(token.owner)} ` +
  `name=${JSON.stringify(token.name)} id=${token.id} scope=${token.scope}`
