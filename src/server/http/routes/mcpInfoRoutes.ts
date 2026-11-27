import { Hono } from 'hono'

import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import { readClaudeConnection } from '#server/db/readClaudeConnection.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { mcpEndpointUrl } from '#server/mcp/mcpEndpointUrl.ts'

export type McpInfoRouteDeps = Pick<RouteDeps, 'db' | 'clock'> & {
  enabled: boolean
  publicUrl: string | null
  oauth: boolean
  checksEnabled: boolean // SIEB_CHECKS_ENABLED
}

/**
 * Creates the MCP setup route, available whether MCP is on or off: GET / answers whether MCP is
 * enabled, the endpoint URL clients connect to, whether OAuth sign-in is configured and, for a
 * signed-in user while enabled, whether Claude reaches sieb for them, and whether Auto-check is on.
 * @param {McpInfoRouteDeps} deps - Database, clock, MCP flag, public origin, OAuth flag and checks flag
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/mcp-info
 */
export const createMcpInfoRoutes = ({
  db,
  clock,
  enabled,
  publicUrl,
  oauth,
  checksEnabled,
}: McpInfoRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const actor = c.get('actor')

    c.header('Cache-Control', 'no-store')

    return c.json<McpInfoResponse>({
      enabled,
      mcpUrl: enabled ? mcpEndpointUrl(publicUrl, c.req.raw).href : null,
      oauth: enabled && oauth,
      claude: enabled && actor !== null ? readClaudeConnection(db, actor, clock()) : null,
      checksEnabled,
    })
  })

  return routes
}
