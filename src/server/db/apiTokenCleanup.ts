import type { DatabaseSync } from 'node:sqlite'

import { isTokenLive, type ApiToken } from '#core/apiToken.ts'
import { getOwnToken, listOwnTokens } from '#server/db/apiTokenRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

/** Revoked and expired token rows stay listed this long, then the cleanup deletes them */
export const TOKEN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export type DeleteTokenResult =
  | { ok: true; token: ApiToken }
  | { ok: false; error: 'not_found' | 'token_live' }

/**
 * Revokes every live token of a user, for a user the identity provider no longer admits.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Token owner
 * @param {Date} now - Revocation time
 * @param {string} revokedBy - Name recorded as revoker
 * @returns {number} - Number of revoked tokens
 */
export const revokeLiveTokensOf = (
  db: DatabaseSync,
  owner: string,
  now: Date,
  revokedBy: string,
): number => {
  const at = now.toISOString()

  return Number(
    db
      .prepare(
        `UPDATE api_tokens SET revoked_at = ?, revoked_by = ?
         WHERE owner = ? AND revoked_at IS NULL AND expires_at > ?`,
      )
      .run(at, revokedBy, owner, at).changes,
  )
}

/**
 * Deletes one revoked or expired token of its owner. Proposals filed with it keep their row,
 * proposer and token_id, which has no foreign key and is never reassigned.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Acting user, who must own the token
 * @param {number} id - Token id
 * @param {Date} now - Time the liveness is checked at
 * @returns {DeleteTokenResult} - Deleted token, not_found for unknown and foreign ids, token_live while it still authenticates
 */
export const deleteOwnInactiveToken = (
  db: DatabaseSync,
  owner: string,
  id: number,
  now: Date,
): DeleteTokenResult =>
  inTransaction(db, () => {
    const token = getOwnToken(db, owner, id)

    if (token === null) {
      return { ok: false, error: 'not_found' }
    }

    if (isTokenLive(token, now)) {
      return { ok: false, error: 'token_live' }
    }

    db.prepare('DELETE FROM api_tokens WHERE id = ? AND owner = ?').run(id, owner)
    return { ok: true, token }
  })

/**
 * Deletes every revoked or expired token of an owner, live tokens stay.
 * @param {DatabaseSync} db - Open database
 * @param {string} owner - Acting user
 * @param {Date} now - Time the liveness is checked at
 * @returns {ApiToken[]} - Deleted tokens, newest first
 */
export const deleteInactiveTokensOf = (db: DatabaseSync, owner: string, now: Date): ApiToken[] =>
  inTransaction(db, () => {
    const inactive = listOwnTokens(db, owner).filter((token) => !isTokenLive(token, now))
    const remove = db.prepare('DELETE FROM api_tokens WHERE id = ? AND owner = ?')

    for (const token of inactive) {
      remove.run(token.id, owner)
    }

    return inactive
  })

/**
 * Deletes token rows revoked or expired more than TOKEN_RETENTION_MS ago, and rows without expiry
 * (never live) created that long ago. Proposals filed with them keep their token_id.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Cleanup time
 * @returns {number} - Number of deleted rows
 */
export const deleteStaleTokens = (db: DatabaseSync, now: Date): number => {
  const cutoff = new Date(now.getTime() - TOKEN_RETENTION_MS).toISOString()

  return Number(
    db
      .prepare(
        `DELETE FROM api_tokens
         WHERE revoked_at < ? OR expires_at < ? OR (expires_at IS NULL AND created_at < ?)`,
      )
      .run(cutoff, cutoff, cutoff).changes,
  )
}
