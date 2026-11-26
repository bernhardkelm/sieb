import type { DatabaseSync } from 'node:sqlite'

import type { McpAuthVia } from '#server/mcp/mcpCaller.ts'

/**
 * Stores when an authenticated MCP request of a user and authentication kind arrived, keeping
 * only the latest time.
 * @param {DatabaseSync} db - Open database
 * @param {{ username: string; via: McpAuthVia }} connection - sieb user and how the caller authenticated
 * @param {Date} now - Request time
 * @returns {void}
 */
export const recordMcpConnection = (
  db: DatabaseSync,
  { username, via }: { username: string; via: McpAuthVia },
  now: Date,
): void => {
  db.prepare(
    `INSERT INTO mcp_connections (username, via, last_seen_at) VALUES (?, ?, ?)
     ON CONFLICT (username, via) DO UPDATE SET last_seen_at = excluded.last_seen_at
     WHERE excluded.last_seen_at > mcp_connections.last_seen_at`,
  ).run(username, via, now.toISOString())
}

/**
 * Reads when the last authenticated MCP request of a user and authentication kind arrived.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - sieb user
 * @param {McpAuthVia} via - Authentication kind
 * @returns {string | null} - ISO time, null when none arrived yet
 */
export const mcpLastSeenAt = (
  db: DatabaseSync,
  username: string,
  via: McpAuthVia,
): string | null => {
  const row = db
    .prepare('SELECT last_seen_at FROM mcp_connections WHERE username = ? AND via = ?')
    .get(username, via) as { last_seen_at: string } | undefined

  return row?.last_seen_at ?? null
}
