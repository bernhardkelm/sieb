import type { ApiToken } from '#core/apiToken.ts'
import type { StoredCheck } from '#server/db/checkRows.ts'
import type { EndedCheck } from '#server/db/endCheck.ts'
import { logSafe } from '#server/logSafe.ts'
import { tokenLogLine } from '#server/tokenLogLine.ts'

/**
 * Describes the target of a check for a log line.
 * @param {StoredCheck} check - Check
 * @returns {string} - Vulnerability and image
 */
const targetText = (check: StoredCheck): string =>
  `${logSafe(check.vulnId)} in ${logSafe(check.imageRef)}`

/**
 * Builds the log line of a claimed check, without the token secret.
 * @param {StoredCheck} check - Started check
 * @param {ApiToken} token - Minted token
 * @returns {string} - Log line
 */
export const claimLogLine = (check: StoredCheck, token: ApiToken): string =>
  `[sieb] check ${check.id} claimed for ${logSafe(check.requestedBy)}: ${targetText(check)}, ` +
  `token ${token.id}`

/**
 * Builds the log line of an ended check, without the reply or the error text of the worker.
 * @param {StoredCheck} check - Ended check
 * @param {string} cause - What ended it, such as "result", "timeout" or "cancelled by alice"
 * @returns {string} - Log line
 */
export const endLogLine = (check: StoredCheck, cause: string): string => {
  const proposal = check.proposalId === null ? 'no proposal' : `proposal ${check.proposalId}`

  return `[sieb] check ${check.id} ${check.state} (${logSafe(cause)}): ${targetText(check)}, ${proposal}`
}

/**
 * Builds the log lines of an ended check and its deleted token.
 * @param {EndedCheck} ended - Ended check and its token
 * @param {string} cause - What ended it
 * @returns {string[]} - Log lines
 */
export const endLogLines = (ended: EndedCheck, cause: string): string[] => [
  endLogLine(ended.check, cause),
  ...(ended.token === null ? [] : [tokenLogLine('deleted', ended.token)]),
]
