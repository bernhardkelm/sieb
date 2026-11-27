import { createHash } from 'node:crypto'

/** Signed-in UI user of the oidc auth mode */
export interface Session {
  idHash: string
  username: string
  groups: string[]
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  idToken: string
}

export interface SessionRow {
  id_hash: string
  username: string
  groups: string
  created_at: string
  last_seen_at: string
  expires_at: string
  id_token: string
}

/**
 * Hashes a session id for storage and lookup, so the database never holds a usable cookie.
 * @param {string} id - Session id from the cookie
 * @returns {string} - Lower-case hex sha-256
 */
export const hashSessionId = (id: string): string =>
  createHash('sha256').update(id, 'utf8').digest('hex')

/**
 * Maps a sessions row to the domain type.
 * @param {SessionRow} row - Row
 * @returns {Session} - Session
 */
export const toSession = (row: SessionRow): Session => ({
  idHash: row.id_hash,
  username: row.username,
  groups: (JSON.parse(row.groups) as unknown[]).filter(
    (group): group is string => typeof group === 'string',
  ),
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
  expiresAt: row.expires_at,
  idToken: row.id_token,
})
