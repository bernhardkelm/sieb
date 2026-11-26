import type { DatabaseSync } from 'node:sqlite'

/** Revoked and expired token rows stay listed this long, then the cleanup deletes them */
export const TOKEN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

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
 * Deletes token rows revoked or expired more than TOKEN_RETENTION_MS ago, and rows without expiry
 * (never live) created that long ago.
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
