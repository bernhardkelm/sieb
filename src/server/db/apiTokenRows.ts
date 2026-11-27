import type { ApiToken, ApiTokenScope } from '#core/apiToken.ts'

export interface ApiTokenRow {
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
  check_id: number | null
}

/** Stored token with its hash and the check it was minted for, for the bearer verifier only */
export type StoredApiToken = ApiToken & { hash: string; checkId: number | null }

/**
 * Maps an api_tokens row to the domain type.
 * @param {ApiTokenRow} row - Row
 * @returns {StoredApiToken} - Token with its hash
 */
export const toToken = (row: ApiTokenRow): StoredApiToken => ({
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
  checkId: row.check_id,
})

/**
 * Drops the hash and check id of a stored token.
 * @param {StoredApiToken} stored - Token with hash
 * @returns {ApiToken} - Token
 */
export const withoutHash = ({
  hash: _hash,
  checkId: _checkId,
  ...token
}: StoredApiToken): ApiToken => token
