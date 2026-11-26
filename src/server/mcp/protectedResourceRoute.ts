import type { OAuthProtectedResourceMetadata } from '@modelcontextprotocol/server'
import { Hono } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { MCP_SCOPES } from '#server/mcp/mcpCaller.ts'
import { MCP_PATH } from '#server/mcp/mcpEndpointUrl.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'

/**
 * Builds the RFC 9728 metadata of the MCP endpoint, naming the OAuth issuer as its only
 * authorization server.
 * @param {string} publicUrl - Public origin
 * @param {OAuthConfig} oauth - OAuth settings
 * @returns {OAuthProtectedResourceMetadata} - Metadata document
 */
export const protectedResourceMetadata = (
  publicUrl: string,
  oauth: OAuthConfig,
): OAuthProtectedResourceMetadata => ({
  resource: new URL(MCP_PATH, publicUrl).href,
  authorization_servers: [oauth.issuer],
  scopes_supported: [...MCP_SCOPES],
  bearer_methods_supported: ['header'],
  resource_name: 'sieb',
})

/**
 * Creates the protected resource metadata routes: GET /oauth-protected-resource and the
 * path-aware GET /oauth-protected-resource/mcp answer the same public document.
 * @param {{ publicUrl: string; oauth: OAuthConfig }} deps - Public origin and OAuth settings
 * @returns {Hono<AppEnv>} - Routes, mounted at /.well-known when OAuth is configured
 */
export const createProtectedResourceRoutes = ({
  publicUrl,
  oauth,
}: {
  publicUrl: string
  oauth: OAuthConfig
}): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()
  const metadata = protectedResourceMetadata(publicUrl, oauth)

  for (const path of ['/oauth-protected-resource', `/oauth-protected-resource${MCP_PATH}`]) {
    routes.get(path, (c) => {
      c.header('Access-Control-Allow-Origin', '*')
      c.header('Cache-Control', 'public, max-age=3600')
      return c.json<OAuthProtectedResourceMetadata>(metadata)
    })
  }

  return routes
}
