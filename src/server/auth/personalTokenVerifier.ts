import type { DatabaseSync } from 'node:sqlite'
import { OAuthError, OAuthErrorCode, type AuthInfo } from '@modelcontextprotocol/server'

import { isTokenLive, scopesOf } from '#core/apiToken.ts'
import type { Clock } from '#core/clock.ts'
import { hashesMatch, hashTokenSecret, isTokenSecret } from '#server/auth/tokenSecrets.ts'
import { findTokenByHash, touchToken } from '#server/db/apiTokenRepository.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'

/** Verifies a bearer value for the protected resource and answers its AuthInfo */
export type BearerTokenCheck = (token: string, resource: URL) => Promise<AuthInfo>

/**
 * Creates the verifier of personal sieb tokens: hashes the secret, looks it up, refuses
 * unknown, revoked, expired and expiry-less tokens and records the use. The caller acts as the token owner.
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

    if (stored.expiresAt === null || !isTokenLive(stored, now)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Token revoked or expired')
    }

    touchToken(db, stored, now)

    const extra: Omit<McpCaller, 'scopes'> = {
      actor: stored.owner,
      via: 'token',
      tokenId: stored.id,
      clientLabel: stored.name,
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
