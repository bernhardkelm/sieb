import type { ServerConfig } from '#server/config.ts'

/**
 * Lists the settings a production deployment should not run without but still may: an OIDC login
 * or OAuth for /mcp that admits every user of the issuer.
 * @param {Pick<ServerConfig, 'production' | 'oidc' | 'oauth'>} config - Parsed configuration
 * @returns {string[]} - Warning lines, empty outside production
 */
export const startupWarnings = ({
  production,
  oidc,
  oauth,
}: Pick<ServerConfig, 'production' | 'oidc' | 'oauth'>): string[] => {
  if (!production) {
    return []
  }

  return [
    oidc !== null && oidc.requiredGroup === null
      ? '[sieb] SIEB_OIDC_REQUIRED_GROUP is unset, every user of the issuer can log in'
      : null,
    oauth !== null && oauth.requiredGroup === null
      ? '[sieb] SIEB_OAUTH_REQUIRED_GROUP is unset, every user of the issuer can use /mcp via OAuth'
      : null,
  ].filter((line) => line !== null)
}
