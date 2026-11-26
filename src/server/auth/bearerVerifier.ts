import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from '@modelcontextprotocol/server'

import { isJwt } from '#server/auth/jwtVerifier.ts'
import type { BearerTokenCheck } from '#server/auth/personalTokenVerifier.ts'
import { TOKEN_SECRET_PREFIX } from '#server/auth/tokenSecrets.ts'

export interface BearerVerifiers {
  personal: BearerTokenCheck
  jwt: BearerTokenCheck | null // null without OAuth settings
}

/**
 * Creates the bearer verifier of one protected resource: sieb_ values go to the personal token
 * verifier, JWTs to the OAuth verifier when configured, anything else is an invalid token.
 * @param {BearerVerifiers} verifiers - Personal token and optional OAuth verifier
 * @param {URL} resource - MCP endpoint URL reported as the token's resource
 * @returns {OAuthTokenVerifier} - Verifier for requireBearerAuth
 */
export const createBearerVerifier = (
  { personal, jwt }: BearerVerifiers,
  resource: URL,
): OAuthTokenVerifier => ({
  verifyAccessToken: async (token) => {
    if (token.startsWith(TOKEN_SECRET_PREFIX)) {
      return personal(token, resource)
    }

    if (jwt !== null && isJwt(token)) {
      return jwt(token, resource)
    }

    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Unknown token')
  },
})
