export const MCP_PATH = '/mcp'

/**
 * Returns the origin a request reached sieb at: its URL with the scheme a TLS-terminating proxy
 * reports in X-Forwarded-Proto.
 * @param {Request} request - Request
 * @returns {string} - Origin
 */
export const requestOrigin = (request: Request): string => {
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()

  if (proto === 'http' || proto === 'https') {
    url.protocol = `${proto}:`
  }

  return url.origin
}

/**
 * Returns the absolute URL of the MCP endpoint, the protected resource of its tokens.
 * @param {string | null} publicUrl - Configured public origin, null derives it from the request
 * @param {Request} request - Request
 * @returns {URL} - Endpoint URL
 */
export const mcpEndpointUrl = (publicUrl: string | null, request: Request): URL =>
  new URL(MCP_PATH, publicUrl ?? requestOrigin(request))
