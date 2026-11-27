import type { McpServer } from '@modelcontextprotocol/server'

import type { McpCaller } from '#server/mcp/mcpCaller.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { registerCheckVulnerabilityTool } from '#server/mcp/tools/checkVulnerabilityTool.ts'
import { registerGetFindingTool } from '#server/mcp/tools/getFindingTool.ts'
import { registerGetImageTool } from '#server/mcp/tools/getImageTool.ts'
import { registerGetOverviewTool } from '#server/mcp/tools/getOverviewTool.ts'
import { registerListDecisionsTool } from '#server/mcp/tools/listDecisionsTool.ts'
import { registerListMyProposalsTool } from '#server/mcp/tools/listMyProposalsTool.ts'
import { registerSearchFindingsTool } from '#server/mcp/tools/searchFindingsTool.ts'

/**
 * Registers the read-only query tools, available with the sieb:read scope, list_my_proposals
 * included. The token of an Auto-check gets neither search_findings nor get_overview, and the
 * other tools answer only for its finding, CVE and image.
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
  if (caller.check === null) {
    registerSearchFindingsTool(server, deps, caller.actor)
    registerGetOverviewTool(server, deps, caller)
  }

  registerCheckVulnerabilityTool(server, deps, caller.check)
  registerGetFindingTool(server, deps, caller.check)
  registerGetImageTool(server, deps, caller.check)
  registerListDecisionsTool(server, deps, caller.check)
  registerListMyProposalsTool(server, deps, caller)
}
