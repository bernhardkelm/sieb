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
 * Parses an absolute http or https URL, https only in production.
 * @param {string} value - Trimmed raw value
 * @param {string} name - Variable name for the error message
 * @param {boolean} production - Whether plain http is refused
 * @returns {URL} - Parsed URL
 * @throws {Error} - For a malformed URL, another scheme or http in production
 */
export const parseWebUrl = (value: string, name: string, production: boolean): URL => {
  const allowed = production ? ['https:'] : ['http:', 'https:']
  const url = URL.canParse(value) ? new URL(value) : null

  if (
    url === null ||
    !allowed.includes(url.protocol) ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error(
      `${name} must be an ${production ? 'https' : 'http or https'} URL, got "${value}"`,
    )
  }

  return url
}

/**
 * Parses a bare origin: scheme, host and optional port, no path, query or fragment.
 * @param {string} value - Trimmed raw value
 * @param {string} name - Variable name for the error message
 * @param {boolean} production - Whether plain http is refused
 * @returns {string} - Origin without a trailing slash
 * @throws {Error} - When the value is not a bare origin
 */
const parseOrigin = (value: string, name: string, production: boolean): string => {
  const url = parseWebUrl(value, name, production)

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '' || value.endsWith('/')) {
    throw new Error(`${name} must be an origin without path or trailing slash, got "${value}"`)
  }

  return url.origin
}

/**
 * Parses the public base URL sieb is reached at, used for links and the MCP resource.
 * @param {string | undefined} value - Raw SIEB_PUBLIC_URL value
 * @param {boolean} production - Whether plain http is refused
 * @returns {string | null} - Origin, null when unset or blank
 * @throws {Error} - When the value is not a bare origin
 */
export const parsePublicUrl = (value: string | undefined, production: boolean): string | null => {
  const trimmed = value?.trim() ?? ''

  return trimmed === '' ? null : parseOrigin(trimmed, 'SIEB_PUBLIC_URL', production)
}

/**
 * Parses the comma separated origins a browser-based MCP client may send.
 * @param {string | undefined} value - Raw SIEB_MCP_ALLOWED_ORIGINS value
 * @returns {string[]} - Normalised origins
 * @throws {Error} - For an entry that is not a bare http or https origin
 */
export const parseOriginList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => parseOrigin(entry, 'SIEB_MCP_ALLOWED_ORIGINS', false))

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
