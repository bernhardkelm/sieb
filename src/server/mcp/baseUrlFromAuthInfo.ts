import type { AuthInfo } from '@modelcontextprotocol/server'

/**
 * Returns the origin for links back into sieb from the resource a bearer token was verified
 * for, the MCP endpoint URL built from SIEB_PUBLIC_URL or the origin of the request.
 * @param {AuthInfo} authInfo - Verified token information
 * @returns {string} - Absolute origin
 * @throws {Error} - When the AuthInfo carries no resource
 */
export const baseUrlFromAuthInfo = (authInfo: AuthInfo): string => {
  if (authInfo.resource === undefined) {
    throw new Error('MCP request without a verified resource')
  }

  return authInfo.resource.origin
}
