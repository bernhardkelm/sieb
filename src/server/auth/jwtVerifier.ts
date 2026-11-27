import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server'
import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'

import type { ApiTokenGrant } from '#core/apiToken.ts'
import type { Clock } from '#core/clock.ts'
import { errorMessage } from '#core/errorMessage.ts'
import type { BearerTokenCheck } from '#server/auth/personalTokenVerifier.ts'
import { readUsername } from '#server/auth/readUsername.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'

export const JWT_ALGORITHMS = ['RS256', 'ES256']

export const JWT_CLOCK_TOLERANCE_SECONDS = 60

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

const ACCESS_TOKEN_TYPES = ['at+jwt', 'application/at+jwt', 'jwt']

export interface JwtVerifierDeps {
  oauth: OAuthConfig
  keys: JWTVerifyGetKey // the issuer's key set, a local set in tests
  clock: Clock
  log: (message: string) => void
}

/**
 * Returns whether a bearer value has the shape of a compact JWS.
 * @param {string} value - Bearer value
 * @returns {boolean} - True for three base64url segments
 */
export const isJwt = (value: string): boolean => JWT_SHAPE.test(value)

/**
 * Reads the sieb scopes of the scope claim, sieb:propose implies sieb:read.
 * @param {unknown} claim - Raw scope claim, space separated
 * @returns {ApiTokenGrant[]} - Granted scopes, empty when none
 */
export const grantsOf = (claim: unknown): ApiTokenGrant[] => {
  const scopes = typeof claim === 'string' ? claim.split(' ') : []

  if (scopes.includes('sieb:propose')) {
    return ['sieb:read', 'sieb:propose']
  }

  return scopes.includes('sieb:read') ? ['sieb:read'] : []
}

/**
 * Verifies signature and registered claims: an allowed algorithm, the exact issuer, the client
 * id as the only audience, an exp within the clock tolerance and, when present, a typ of at+jwt
 * or JWT. An ID token of another client fails the audience, one without the sieb scopes the
 * scope check.
 * @param {string} token - Compact JWT
 * @param {JwtVerifierDeps} deps - OAuth settings, keys, clock and logger
 * @returns {Promise<JWTPayload>} - Verified claims
 * @throws {OAuthError} - invalid_token for a refused token, server_error when the keys are unreachable
 */
const verifyClaims = async (
  token: string,
  { oauth, keys, clock, log }: JwtVerifierDeps,
): Promise<JWTPayload> => {
  let verified: Awaited<ReturnType<typeof jwtVerify>>

  try {
    verified = await jwtVerify(token, keys, {
      algorithms: JWT_ALGORITHMS,
      issuer: oauth.issuer,
      audience: oauth.clientId,
      requiredClaims: ['exp'],
      clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS,
      currentDate: clock(),
    })
  } catch (error) {
    if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token')
    }

    log(`[sieb] OAuth key lookup failed: ${errorMessage(error)}`)
    throw new OAuthError(OAuthErrorCode.ServerError, 'Token keys unavailable')
  }

  const { payload, protectedHeader } = verified
  const { aud } = payload
  const typ = protectedHeader.typ?.toLowerCase()

  if (
    !(
      aud === oauth.clientId ||
      (Array.isArray(aud) && aud.length === 1 && aud[0] === oauth.clientId)
    ) ||
    (typ !== undefined && !ACCESS_TOKEN_TYPES.includes(typ))
  ) {
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token')
  }

  return payload
}

/**
 * Creates the verifier of authentik OAuth access tokens. The caller acts as preferred_username;
 * with a required group the groups claim must contain it.
 * @param {JwtVerifierDeps} deps - OAuth settings, keys, clock and logger
 * @returns {BearerTokenCheck} - Verifier, throws OAuthError on refusal
 */
export const createJwtVerifier =
  (deps: JwtVerifierDeps): BearerTokenCheck =>
  async (token, resource) => {
    const payload = await verifyClaims(token, deps)
    const actor = readUsername(payload.preferred_username)
    const groups = Array.isArray(payload.groups) ? (payload.groups as unknown[]) : []
    const { requiredGroup, clientId, clientLabel } = deps.oauth

    if (actor === null) {
      throw new OAuthError(
        OAuthErrorCode.InvalidToken,
        'Access token has no usable preferred_username',
      )
    }

    if (requiredGroup !== null && !groups.includes(requiredGroup)) {
      throw new OAuthError(OAuthErrorCode.InsufficientScope, 'Caller is not in the required group')
    }

    const extra: Omit<McpCaller, 'scopes'> = {
      actor,
      via: 'oauth',
      tokenId: null,
      clientLabel,
      check: null,
    }

    return {
      token,
      clientId: typeof payload.azp === 'string' ? payload.azp : clientId,
      scopes: grantsOf(payload.scope),
      expiresAt: payload.exp,
      resource,
      extra: { ...extra },
    }
  }
