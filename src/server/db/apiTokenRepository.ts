import type { DatabaseSync } from 'node:sqlite'

import type { ApiToken } from '#core/apiToken.ts'
import {
  toToken,
  withoutHash,
  type ApiTokenRow,
  type StoredApiToken,
} from '#server/db/apiTokenRows.ts'
import { MINUTE_MS } from '#core/timeUnits.ts'

/** last_used_at is written at most once per this interval, so every MCP request is not a write */
export const TOUCH_INTERVAL_MS = MINUTE_MS

/**
 * Reads one token of an owner.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Owner
 * @param {number} id - Token id
 * @returns {ApiToken | null} - Token, null when missing or owned by someone else
 */
export const getOwnToken = (db: DatabaseSync, owner: string, id: number): ApiToken | null => {
  const row = db.prepare('SELECT * FROM api_tokens WHERE id = ? AND owner = ?').get(id, owner) as
    | ApiTokenRow
    | undefined

  return row ? withoutHash(toToken(row)) : null
}

/**
 * Reads one personal token of an owner, never the token of a check, which only the check's end
 * revokes and deletes.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Owner
 * @param {number} id - Token id
 * @returns {ApiToken | null} - Token, null when missing, owned by someone else or a check token
 */
export const getUserToken = (db: DatabaseSync, owner: string, id: number): ApiToken | null => {
  const row = db
    .prepare('SELECT * FROM api_tokens WHERE id = ? AND owner = ? AND check_id IS NULL')
    .get(id, owner) as ApiTokenRow | undefined

  return row ? withoutHash(toToken(row)) : null
}

/**
 * Lists the personal tokens of an owner, revoked and expired ones included, newest first. Check
 * tokens are internal and left out.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Owner
 * @returns {ApiToken[]} - Tokens
 */
export const listOwnTokens = (db: DatabaseSync, owner: string): ApiToken[] =>
  (
    db
      .prepare(
        `SELECT * FROM api_tokens WHERE owner = ? AND check_id IS NULL
         ORDER BY created_at DESC, id DESC`,
      )
      .all(owner) as unknown as ApiTokenRow[]
  ).map((row) => withoutHash(toToken(row)))

/**
 * Finds a token by the hash of its secret.
 * @param {DatabaseSync} db - Open database
 * @param {string} hash - sha-256 hex of the presented secret
 * @returns {StoredApiToken | null} - Token with hash, null when unknown
 */
export const findTokenByHash = (db: DatabaseSync, hash: string): StoredApiToken | null => {
  const row = db.prepare('SELECT * FROM api_tokens WHERE token_hash = ?').get(hash) as
    | ApiTokenRow
    | undefined

  return row ? toToken(row) : null
}

/**
 * Revokes a personal token of its owner; revoking it again keeps the first revocation. Check
 * tokens are refused, cancelling the check ends them.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Acting user, who must own the token
 * @param {number} id - Token id
 * @param {Date} now - Revocation time
 * @returns {ApiToken | null} - Revoked token, null when missing, owned by someone else or a check token
 */
export const revokeOwnToken = (
  db: DatabaseSync,
  owner: string,
  id: number,
  now: Date,
): ApiToken | null => {
  db.prepare(
    `UPDATE api_tokens SET revoked_at = ?, revoked_by = ?
     WHERE id = ? AND owner = ? AND revoked_at IS NULL AND check_id IS NULL`,
  ).run(now.toISOString(), owner, id, owner)

  return getUserToken(db, owner, id)
}

/**
 * Records the use of a token, at most once per TOUCH_INTERVAL_MS.
 * @param {DatabaseSync} db - Open database
 * @param {ApiToken} token - Token that authenticated a request
 * @param {Date} now - Time of use
 * @returns {void}
 */
export const touchToken = (db: DatabaseSync, token: ApiToken, now: Date): void => {
  if (
    token.lastUsedAt !== null &&
    now.getTime() - Date.parse(token.lastUsedAt) < TOUCH_INTERVAL_MS
  ) {
    return
  }

  db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(now.toISOString(), token.id)
}
