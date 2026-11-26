import * as client from 'openid-client'

import { retryingCache } from '#server/auth/retryingCache.ts'

/**
 * Scopes of the UI login. authentik's default profile scope mapping already carries the groups
 * claim; groups is requested too for issuers with a separate groups scope, authentik drops
 * scopes it has no mapping for.
 */
export const OIDC_SCOPES = ['openid', 'profile', 'email', 'groups'] as const

export const CALLBACK_PATH = '/auth/callback'

const DISCOVERY_TIMEOUT_SECONDS = 10

export interface OidcClientSettings {
  issuer: string
  clientId: string
  clientSecret: string
  fetch?: client.CustomFetch // replaces fetch for discovery, token and JWKS requests, for tests
  now?: () => number // time source in ms of the failure cache
}

export interface OidcClient {
  configuration: () => Promise<client.Configuration>
}

/**
 * Discovers the issuer metadata and builds the client configuration: client_secret_post, ID
 * token signatures checked against the issuer JWKS on top of the TLS-protected token response,
 * and plain http only for an http issuer, which the config refuses in production.
 * @param {OidcClientSettings} settings - Issuer, client credentials, optional fetch
 * @returns {Promise<client.Configuration>} - Client configuration
 */
const discover = ({
  issuer,
  clientId,
  clientSecret,
  fetch,
}: OidcClientSettings): Promise<client.Configuration> => {
  const url = new URL(issuer)
  const execute = [client.enableNonRepudiationChecks]

  if (url.protocol === 'http:') {
    execute.push(client.allowInsecureRequests)
  }

  return client.discovery(url, clientId, undefined, client.ClientSecretPost(clientSecret), {
    execute,
    timeout: DISCOVERY_TIMEOUT_SECONDS,
    ...(fetch === undefined ? {} : { [client.customFetch]: fetch }),
  })
}

/**
 * Creates the OIDC client of the UI login. Discovery runs on first use and is cached for the
 * process; a failed discovery is reused for 30 s, then the next login tries again.
 * @param {OidcClientSettings} settings - Issuer, client credentials, optional fetch and time source
 * @returns {OidcClient} - Client
 */
export const createOidcClient = (settings: OidcClientSettings): OidcClient => ({
  configuration: retryingCache(() => discover(settings), settings.now ? { now: settings.now } : {}),
})
