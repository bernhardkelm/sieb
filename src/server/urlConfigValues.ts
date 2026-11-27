/**
 * Validates an http or https URL setting.
 * @param {string | undefined} value - Raw value
 * @param {string} name - Variable name for the error message
 * @param {string} fallback - URL when unset or blank
 * @returns {string} - URL
 * @throws {Error} - When the value is not an http or https URL
 */
export const parseHttpUrl = (value: string | undefined, name: string, fallback: string): string => {
  const url = value?.trim() || fallback

  if (!URL.canParse(url) || !['http:', 'https:'].includes(new URL(url).protocol)) {
    throw new Error(`${name} must be an http or https URL, got "${value}"`)
  }

  return url
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
