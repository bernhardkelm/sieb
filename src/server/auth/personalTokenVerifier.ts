import type { DatabaseSync } from 'node:sqlite'
import { OAuthError, OAuthErrorCode, type AuthInfo } from '@modelcontextprotocol/server'

import { isTokenLive, scopesOf } from '#core/apiToken.ts'
import type { Clock } from '#core/clock.ts'
import { hashesMatch, hashTokenSecret, isTokenSecret } from '#server/auth/tokenSecrets.ts'
import { findTokenByHash, touchToken } from '#server/db/apiTokenRepository.ts'
import type { StoredApiToken } from '#server/db/apiTokenRows.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import type { CheckScope, McpCaller } from '#server/mcp/mcpCaller.ts'

/** Verifies a bearer value for the protected resource and answers its AuthInfo */
export type BearerTokenCheck = (token: string, resource: URL) => Promise<AuthInfo>

/**
 * Resolves the check a check token is bound to; the check must be running with this token.
 * @param {DatabaseSync} db - Open database
 * @param {StoredApiToken} stored - Token with its check id
 * @returns {CheckScope | null | undefined} - Scope, null for a personal token, undefined when the check no longer runs
 */
const checkScopeOf = (db: DatabaseSync, stored: StoredApiToken): CheckScope | null | undefined => {
  if (stored.checkId === null) {
    return null
  }

  const check = getCheck(db, stored.checkId)

  return check?.state === 'running' && check.tokenId === stored.id
    ? {
        checkId: check.id,
        findingId: check.findingId,
        vulnId: check.vulnId,
        imageRef: check.imageRef,
      }
    : undefined
}

/**
 * Creates the verifier of personal sieb tokens: hashes the secret, looks it up, refuses
 * unknown, revoked, expired and expiry-less tokens and records the use. The caller acts as the
 * token owner; the token of an Auto-check carries the scope of its check and is refused once the
 * check no longer runs.
 * @param {{ db: DatabaseSync; clock: Clock }} deps - Database and clock
 * @returns {BearerTokenCheck} - Verifier, throws OAuthError invalid_token on refusal
 */
export const createPersonalTokenVerifier =
  ({ db, clock }: { db: DatabaseSync; clock: Clock }): BearerTokenCheck =>
  async (token, resource) => {
    const hash = isTokenSecret(token) ? hashTokenSecret(token) : null
    const stored = hash === null ? null : findTokenByHash(db, hash)
    const now = clock()

    if (hash === null || stored === null || !hashesMatch(stored.hash, hash)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Unknown token')
    }

    const check = checkScopeOf(db, stored)

    if (stored.expiresAt === null || !isTokenLive(stored, now) || check === undefined) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Token revoked or expired')
    }

    touchToken(db, stored, now)

    const extra: Omit<McpCaller, 'scopes'> = {
      actor: stored.owner,
      via: 'token',
      tokenId: stored.id,
      clientLabel: stored.name,
      check,
    }

    return {
      token,
      clientId: `sieb-token-${stored.id}`,
      scopes: scopesOf(stored.scope),
      expiresAt: Math.floor(Date.parse(stored.expiresAt) / 1000),
      resource,
      extra: { ...extra },
    }
  }
