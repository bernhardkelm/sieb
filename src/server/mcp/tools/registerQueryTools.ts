import type { McpServer } from '@modelcontextprotocol/server'

import type { McpCaller } from '#server/mcp/mcpCaller.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { registerCheckVulnerabilityTool } from '#server/mcp/tools/checkVulnerabilityTool.ts'
import { registerGetFindingTool } from '#server/mcp/tools/getFindingTool.ts'
import { registerGetImageTool } from '#server/mcp/tools/getImageTool.ts'
import { registerGetOverviewTool } from '#server/mcp/tools/getOverviewTool.ts'
import { registerListDecisionsTool } from '#server/mcp/tools/listDecisionsTool.ts'
import { registerSearchFindingsTool } from '#server/mcp/tools/searchFindingsTool.ts'

/**
 * Registers the read-only query tools, available with the sieb:read scope.
 * @param {McpServer} server - MCP server of one request
 * @param {McpToolDeps} deps - Database, clock, KEV source and link base
 * @param {McpCaller} caller - Authenticated caller
 * @returns {void}
 */
export const registerQueryTools = (
  server: McpServer,
  deps: McpToolDeps,
  caller: McpCaller,
): void => {
  registerSearchFindingsTool(server, deps)
  registerCheckVulnerabilityTool(server, deps)
  registerGetFindingTool(server, deps)
  registerGetImageTool(server, deps)
  registerListDecisionsTool(server, deps)
  registerGetOverviewTool(server, deps, caller)
}
