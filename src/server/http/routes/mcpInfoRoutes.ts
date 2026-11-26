import { Hono } from 'hono'

import type { McpInfoResponse } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { mcpEndpointUrl } from '#server/mcp/mcpEndpointUrl.ts'

/**
 * Creates the MCP setup route, available whether MCP is on or off: GET / answers whether MCP is
 * enabled, the endpoint URL clients connect to and whether OAuth sign-in is configured.
 * @param {{ enabled: boolean; publicUrl: string | null; oauth: boolean }} deps - MCP flag, public origin and OAuth flag
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/mcp-info
 */
export const createMcpInfoRoutes = ({
  enabled,
  publicUrl,
  oauth,
}: {
  enabled: boolean
  publicUrl: string | null
  oauth: boolean
}): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) =>
    c.json<McpInfoResponse>({
      enabled,
      mcpUrl: enabled ? mcpEndpointUrl(publicUrl, c.req.raw).href : null,
      oauth: enabled && oauth,
    }),
  )

  return routes
}
