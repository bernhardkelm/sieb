import { createHash, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

/** last_seen_at is written at most once per this interval, so every request is not a write */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000

const SESSION_ID_BYTES = 32
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/

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

export interface NewSession {
  username: string
  groups: readonly string[]
  idToken: string
}

interface SessionRow {
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
const toSession = (row: SessionRow): Session => ({
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

/**
 * Stores a new session that ends lifetimeMs after now, whatever happens in between.
 * @param {DatabaseSync} db - Open database
 * @param {NewSession} session - Username, groups and ID token of the login
 * @param {Date} now - Login time
 * @param {number} lifetimeMs - Absolute session lifetime
 * @returns {string} - Session id for the cookie, 32 random bytes in base64url
 */
export const createSession = (
  db: DatabaseSync,
  { username, groups, idToken }: NewSession,
  now: Date,
  lifetimeMs: number,
): string => {
  const id = randomBytes(SESSION_ID_BYTES).toString('base64url')
  const at = now.toISOString()

  db.prepare(
    `INSERT INTO sessions (id_hash, username, groups, created_at, last_seen_at, expires_at, id_token)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    hashSessionId(id),
    username,
    JSON.stringify(groups),
    at,
    at,
    new Date(now.getTime() + lifetimeMs).toISOString(),
    idToken,
  )

  return id
}

/**
 * Resolves a session id to its live session. An expired session is deleted on the way, a live
 * one gets last_seen_at written at most once per SESSION_TOUCH_INTERVAL_MS.
 * @param {DatabaseSync} db - Open database
 * @param {string} id - Session id from the cookie
 * @param {Date} now - Request time
 * @returns {Session | null} - Session, null for malformed, unknown and expired ids
 */
export const findSession = (db: DatabaseSync, id: string, now: Date): Session | null => {
  if (!SESSION_ID_PATTERN.test(id)) {
    return null
  }

  const idHash = hashSessionId(id)
  const row = db.prepare('SELECT * FROM sessions WHERE id_hash = ?').get(idHash) as
    | SessionRow
    | undefined

  if (row === undefined) {
    return null
  }

  const at = now.toISOString()

  if (row.expires_at <= at) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash)
    return null
  }

  if (now.getTime() - Date.parse(row.last_seen_at) >= SESSION_TOUCH_INTERVAL_MS) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?').run(at, idHash)
    return toSession({ ...row, last_seen_at: at })
  }

  return toSession(row)
}

/**
 * Deletes a session, expired or not.
 * @param {DatabaseSync} db - Open database
 * @param {string} id - Session id from the cookie
 * @returns {Session | null} - Deleted session, null for malformed and unknown ids
 */
export const deleteSession = (db: DatabaseSync, id: string): Session | null => {
  if (!SESSION_ID_PATTERN.test(id)) {
    return null
  }

  const row = db
    .prepare('DELETE FROM sessions WHERE id_hash = ? RETURNING *')
    .get(hashSessionId(id)) as SessionRow | undefined

  return row === undefined ? null : toSession(row)
}

/**
 * Deletes every session of a user.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - User
 * @returns {number} - Number of deleted sessions
 */
export const deleteSessionsOf = (db: DatabaseSync, username: string): number =>
  Number(db.prepare('DELETE FROM sessions WHERE username = ?').run(username).changes)

/**
 * Deletes every session whose expiry has passed.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Cleanup time
 * @returns {number} - Number of deleted sessions
 */
export const deleteExpiredSessions = (db: DatabaseSync, now: Date): number =>
  Number(db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString()).changes)
