import type { DatabaseSync } from 'node:sqlite'

import {
  MAX_LIVE_TOKENS,
  type ApiToken,
  type ApiTokenInput,
  type ApiTokenScope,
} from '#core/apiToken.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

/** last_used_at is written at most once per this interval, so every MCP request is not a write */
export const TOUCH_INTERVAL_MS = 60 * 1000

interface ApiTokenRow {
  id: number
  owner: string
  name: string
  scope: string
  token_prefix: string
  token_hash: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  revoked_by: string | null
}

/** Stored token with its hash, for the bearer verifier only */
export type StoredApiToken = ApiToken & { hash: string }

export type InsertTokenResult =
  | { ok: true; token: ApiToken }
  | { ok: false; error: 'too_many_tokens' }

/**
 * Maps an api_tokens row to the domain type.
 * @param {ApiTokenRow} row - Row
 * @returns {StoredApiToken} - Token with its hash
 */
const toToken = (row: ApiTokenRow): StoredApiToken => ({
  id: row.id,
  owner: row.owner,
  name: row.name,
  scope: row.scope as ApiTokenScope,
  prefix: row.token_prefix,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at,
  revokedBy: row.revoked_by,
  hash: row.token_hash,
})

/**
 * Drops the hash of a stored token.
 * @param {StoredApiToken} stored - Token with hash
 * @returns {ApiToken} - Token
 */
const withoutHash = ({ hash: _hash, ...token }: StoredApiToken): ApiToken => token

/**
 * Reads one token of an owner.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Owner
 * @param {number} id - Token id
 * @returns {ApiToken | null} - Token, null when missing or owned by someone else
 */
const getOwnToken = (db: DatabaseSync, owner: string, id: number): ApiToken | null => {
  const row = db.prepare('SELECT * FROM api_tokens WHERE id = ? AND owner = ?').get(id, owner) as
    | ApiTokenRow
    | undefined

  return row ? withoutHash(toToken(row)) : null
}

/**
 * Stores a new token unless its owner already holds MAX_LIVE_TOKENS live tokens.
 * @param {DatabaseSync} db - Open database
 * @param {{ owner: string; input: ApiTokenInput; prefix: string; hash: string }} token - Owner, validated input, display prefix and secret hash
 * @param {Date} now - Creation time
 * @returns {InsertTokenResult} - Stored token or the refusal
 */
export const insertToken = (
  db: DatabaseSync,
  {
    owner,
    input,
    prefix,
    hash,
  }: { owner: string; input: ApiTokenInput; prefix: string; hash: string },
  now: Date,
): InsertTokenResult =>
  inTransaction(db, () => {
    const at = now.toISOString()
    const live = db
      .prepare(
        `SELECT COUNT(*) AS n FROM api_tokens
         WHERE owner = ? AND revoked_at IS NULL AND expires_at > ?`,
      )
      .get(owner, at)?.n

    if (Number(live) >= MAX_LIVE_TOKENS) {
      return { ok: false, error: 'too_many_tokens' }
    }

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(owner, input.name, input.scope, prefix, hash, at, input.expiresAt)
    const token = getOwnToken(db, owner, Number(lastInsertRowid))

    if (token === null) {
      throw new Error(`api token ${lastInsertRowid} vanished`)
    }

    return { ok: true, token }
  })

/**
 * Lists the tokens of an owner, revoked and expired ones included, newest first.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Owner
 * @returns {ApiToken[]} - Tokens
 */
export const listOwnTokens = (db: DatabaseSync, owner: string): ApiToken[] =>
  (
    db
      .prepare('SELECT * FROM api_tokens WHERE owner = ? ORDER BY created_at DESC, id DESC')
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
 * Revokes a token of its owner; revoking it again keeps the first revocation.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Acting user, who must own the token
 * @param {number} id - Token id
 * @param {Date} now - Revocation time
 * @returns {ApiToken | null} - Revoked token, null when missing or owned by someone else
 */
export const revokeOwnToken = (
  db: DatabaseSync,
  owner: string,
  id: number,
  now: Date,
): ApiToken | null => {
  db.prepare(
    `UPDATE api_tokens SET revoked_at = ?, revoked_by = ?
     WHERE id = ? AND owner = ? AND revoked_at IS NULL`,
  ).run(now.toISOString(), owner, id, owner)

  return getOwnToken(db, owner, id)
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
