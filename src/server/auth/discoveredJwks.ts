import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose'

import { retryingCache } from '#server/auth/retryingCache.ts'

const DISCOVERY_TIMEOUT_MS = 5000

/**
 * Returns the OpenID discovery URL of an issuer: the issuer, a slash, then
 * .well-known/openid-configuration.
 * @param {string} issuer - Issuer as configured
 * @returns {URL} - Discovery document URL
 */
export const discoveryUrlOf = (issuer: string): URL =>
  new URL(`${issuer.endsWith('/') ? issuer : `${issuer}/`}.well-known/openid-configuration`)

/**
 * Reads jwks_uri from the issuer's discovery document, which must name the same issuer.
 * @param {string} issuer - Issuer as configured
 * @param {typeof fetch} fetchImpl - Fetch implementation
 * @returns {Promise<URL>} - JWKS URL
 * @throws {Error} - For a failed fetch, an issuer mismatch or a missing jwks_uri, which must be https for an https issuer
 */
const discoverJwksUrl = async (issuer: string, fetchImpl: typeof fetch): Promise<URL> => {
  const response = await fetchImpl(discoveryUrlOf(issuer), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`OpenID discovery answered ${response.status}`)
  }

  const document = (await response.json()) as { issuer?: unknown; jwks_uri?: unknown }
  const jwksUri = typeof document.jwks_uri === 'string' ? document.jwks_uri : ''
  const schemes = new URL(issuer).protocol === 'https:' ? ['https:'] : ['http:', 'https:']

  if (document.issuer !== issuer) {
    throw new Error('OpenID discovery names another issuer')
  }

  if (!URL.canParse(jwksUri) || !schemes.includes(new URL(jwksUri).protocol)) {
    throw new Error('OpenID discovery has no usable jwks_uri')
  }

  return new URL(jwksUri)
}

/**
 * Creates the key resolver of the issuer's JSON Web Key Set: the configured JWKS URL, else the
 * jwks_uri from OpenID discovery, looked up on first use. A failed lookup is reused for 30 s
 * before the next try. jose caches the keys and refetches them for an unknown key id.
 * @param {{ issuer: string; jwksUrl: string | null }} oauth - Issuer and optional JWKS URL
 * @param {typeof fetch} fetchImpl - Fetch implementation for discovery
 * @param {() => number} now - Time source in ms, for the failure cache
 * @returns {JWTVerifyGetKey} - Key resolver for jwtVerify
 */
export const createDiscoveredJwks = (
  { issuer, jwksUrl }: { issuer: string; jwksUrl: string | null },
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): JWTVerifyGetKey => {
  const keys = retryingCache(
    () =>
      (jwksUrl === null
        ? discoverJwksUrl(issuer, fetchImpl)
        : Promise.resolve(new URL(jwksUrl))
      ).then((url) => createRemoteJWKSet(url)),
    { now },
  )

  return async (header, token) => (await keys())(header, token)
}
