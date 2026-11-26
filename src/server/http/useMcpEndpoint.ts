import type { Hono } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { mcpBodyLimit, mcpOriginGuard } from '#server/mcp/mcpGuards.ts'
import { createMcpRoute, type McpRouteDeps } from '#server/mcp/mcpRoute.ts'
import { createProtectedResourceRoutes } from '#server/mcp/protectedResourceRoute.ts'

export interface McpEndpointSetup extends McpRouteDeps {
  allowedOrigins: readonly string[] // browser origins /mcp accepts besides the requested host
}

/**
 * Mounts /mcp with its own chain (Origin, body limit, then the route with bearer token and rate
 * limit) and, with OAuth and a public URL, the protected resource metadata under /.well-known.
 * @param {Hono<AppEnv>} app - App, before the /api middleware is mounted
 * @param {McpEndpointSetup} setup - Route dependencies and the allowed browser origins
 * @returns {void}
 */
export const useMcpEndpoint = (
  app: Hono<AppEnv>,
  { allowedOrigins, ...routeDeps }: McpEndpointSetup,
): void => {
  app.all('/mcp', mcpOriginGuard(allowedOrigins), mcpBodyLimit(), createMcpRoute(routeDeps))

  const { oauth, publicUrl } = routeDeps
  if (oauth !== null && publicUrl !== null) {
    app.route('/.well-known', createProtectedResourceRoutes({ publicUrl, oauth }))
  }
}
