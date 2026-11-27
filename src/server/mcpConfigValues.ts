import { parseWebUrl } from '#server/urlConfigValues.ts'

export const DEFAULT_OAUTH_CLIENT_LABEL = 'Claude'

/** OAuth resource server settings for the Claude connector, tokens come from the issuer */
export interface OAuthConfig {
  issuer: string // exact iss claim, also the base of the OpenID discovery document
  clientId: string // exact aud claim
  jwksUrl: string | null // null discovers jwks_uri from the issuer
  requiredGroup: string | null // groups claim entry a caller must have, null admits every user
  clientLabel: string // client label of OAuth callers in logs and proposals
}

/**
 * Reads the OAuth settings. Issuer and client id come together or not at all, and OAuth needs
 * the public URL, which names the protected resource.
 * @param {Record<string, string | undefined>} env - Environment
 * @param {string | null} publicUrl - Parsed SIEB_PUBLIC_URL
 * @param {boolean} production - Whether plain http is refused
 * @returns {OAuthConfig | null} - Settings, null when OAuth is not configured
 * @throws {Error} - For incomplete or invalid settings
 */
export const readOAuthConfig = (
  env: Record<string, string | undefined>,
  publicUrl: string | null,
  production: boolean,
): OAuthConfig | null => {
  const issuer = env.SIEB_OAUTH_ISSUER?.trim() || null
  const clientId = env.SIEB_OAUTH_CLIENT_ID?.trim() || null
  const jwksUrl = env.SIEB_OAUTH_JWKS_URL?.trim() || null

  if (issuer === null && clientId === null) {
    if (jwksUrl !== null) {
      throw new Error('SIEB_OAUTH_JWKS_URL needs SIEB_OAUTH_ISSUER and SIEB_OAUTH_CLIENT_ID')
    }

    return null
  }

  if (issuer === null || clientId === null) {
    throw new Error('SIEB_OAUTH_ISSUER and SIEB_OAUTH_CLIENT_ID must be set together')
  }

  if (publicUrl === null) {
    throw new Error('SIEB_OAUTH_ISSUER needs SIEB_PUBLIC_URL')
  }

  parseWebUrl(issuer, 'SIEB_OAUTH_ISSUER', production)

  return {
    issuer,
    clientId,
    jwksUrl: jwksUrl === null ? null : parseWebUrl(jwksUrl, 'SIEB_OAUTH_JWKS_URL', production).href,
    requiredGroup: env.SIEB_OAUTH_REQUIRED_GROUP?.trim() || null,
    clientLabel: env.SIEB_OAUTH_CLIENT_LABEL?.trim() || DEFAULT_OAUTH_CLIENT_LABEL,
  }
}
