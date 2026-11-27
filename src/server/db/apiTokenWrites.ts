import type { DatabaseSync } from 'node:sqlite'

import { MAX_LIVE_TOKENS, type ApiToken, type ApiTokenInput } from '#core/apiToken.ts'
import { getOwnToken } from '#server/db/apiTokenRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

export type InsertTokenResult =
  | { ok: true; token: ApiToken }
  | { ok: false; error: 'too_many_tokens' }

/** What a new token row holds besides its id and times */
export interface NewToken {
  owner: string
  input: ApiTokenInput
  prefix: string
  hash: string
  checkId?: number // set only for the token of a check
}

/**
 * Stores a new token without the live-token cap, for callers that enforce their own limits. Its
 * id lies above every token id and every token_id of a proposal or check, so the id of a deleted
 * token that proposals or checks still name is never handed out again.
 * @param {DatabaseSync} db - Open database
 * @param {NewToken} token - Owner, validated input, display prefix, secret hash and check
 * @param {Date} now - Creation time
 * @returns {ApiToken} - Stored token
 */
export const storeToken = (
  db: DatabaseSync,
  { owner, input, prefix, hash, checkId }: NewToken,
  now: Date,
): ApiToken => {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO api_tokens
         (id, owner, name, scope, token_prefix, token_hash, created_at, expires_at, check_id)
       VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM (
         SELECT MAX(id) AS id FROM api_tokens
         UNION ALL SELECT MAX(token_id) FROM decision_proposals
         UNION ALL SELECT MAX(token_id) FROM checks
       )), ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      owner,
      input.name,
      input.scope,
      prefix,
      hash,
      now.toISOString(),
      input.expiresAt,
      checkId ?? null,
    )
  const token = getOwnToken(db, owner, Number(lastInsertRowid))

  if (token === null) {
    throw new Error(`api token ${lastInsertRowid} vanished`)
  }

  return token
}

/**
 * Stores a new personal token unless its owner already holds MAX_LIVE_TOKENS live ones, see
 * storeToken. Check tokens do not count.
 * @param {DatabaseSync} db - Open database
 * @param {Omit<NewToken, 'checkId'>} token - Owner, validated input, display prefix and secret hash
 * @param {Date} now - Creation time
 * @returns {InsertTokenResult} - Stored token or the refusal
 */
export const insertToken = (
  db: DatabaseSync,
  { owner, input, prefix, hash }: Omit<NewToken, 'checkId'>,
  now: Date,
): InsertTokenResult =>
  inTransaction(db, () => {
    const at = now.toISOString()
    const live = db
      .prepare(
        `SELECT COUNT(*) AS n FROM api_tokens
         WHERE owner = ? AND revoked_at IS NULL AND expires_at > ? AND check_id IS NULL`,
      )
      .get(owner, at)?.n

    if (Number(live) >= MAX_LIVE_TOKENS) {
      return { ok: false, error: 'too_many_tokens' }
    }

    return { ok: true, token: storeToken(db, { owner, input, prefix, hash }, now) }
  })

/**
 * Deletes one token row of an owner.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Token owner
 * @param {number} id - Token id
 * @returns {void}
 */
export const deleteTokenRow = (db: DatabaseSync, owner: string, id: number): void => {
  db.prepare('DELETE FROM api_tokens WHERE id = ? AND owner = ?').run(id, owner)
}
