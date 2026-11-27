import type { DatabaseSync } from 'node:sqlite'

import { isTokenLive } from '#core/apiToken.ts'
import type { ClaudeConnection } from '#core/mcpApiTypes.ts'
import { listOwnTokens } from '#server/db/apiTokenRepository.ts'
import { mcpLastSeenAt } from '#server/db/mcpConnectionRepository.ts'
import { DAY_MS } from '#core/timeUnits.ts'

/** An OAuth MCP request within this window counts as a connected claude.ai connector */
export const OAUTH_CONNECTION_WINDOW_MS = 30 * DAY_MS

/**
 * Reads whether Claude can reach sieb for a user: with at least one live personal token, or
 * with an OAuth authenticated MCP request within OAUTH_CONNECTION_WINDOW_MS. The token of a
 * running Auto-check is no connection of the user and does not count.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - sieb user
 * @param {Date} now - Current time
 * @returns {ClaudeConnection} - Connected flag, live token count and the last OAuth request
 */
export const readClaudeConnection = (
  db: DatabaseSync,
  username: string,
  now: Date,
): ClaudeConnection => {
  const activeTokens = listOwnTokens(db, username).filter((token) => isTokenLive(token, now)).length
  const oauthLastSeenAt = mcpLastSeenAt(db, username, 'oauth')
  const oauthRecent =
    oauthLastSeenAt !== null &&
    now.getTime() - Date.parse(oauthLastSeenAt) <= OAUTH_CONNECTION_WINDOW_MS

  return { connected: activeTokens > 0 || oauthRecent, activeTokens, oauthLastSeenAt }
}
