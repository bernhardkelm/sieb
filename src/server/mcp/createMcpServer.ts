import { McpServer, type AuthInfo } from '@modelcontextprotocol/server'

import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { baseUrlFromAuthInfo } from '#server/mcp/baseUrlFromAuthInfo.ts'
import { callerFromAuthInfo } from '#server/mcp/callerFromAuthInfo.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { SERVER_INSTRUCTIONS } from '#server/mcp/serverInstructions.ts'
import { registerQueryTools } from '#server/mcp/tools/registerQueryTools.ts'
import { registerTriagePrompt } from '#server/mcp/triagePrompt.ts'

/**
 * Creates the MCP server of one request: the read-only query tools for the caller and the
 * triage prompt, with the server instructions that explain sieb to the model. Links use the
 * origin of the resource the token was verified for.
 * @param {RouteDeps} deps - Database, clock and KEV source
 * @param {AuthInfo} authInfo - Verified token information of the request
 * @param {string} version - sieb version reported in serverInfo
 * @returns {McpServer} - Server, connected to a transport by the handler
 */
export const createMcpServer = (
  deps: RouteDeps,
  authInfo: AuthInfo,
  version: string,
): McpServer => {
  const server = new McpServer({ name: 'sieb', version }, { instructions: SERVER_INSTRUCTIONS })
  const toolDeps: McpToolDeps = {
    db: deps.db,
    clock: deps.clock,
    kevSource: deps.kevSource,
    baseUrl: baseUrlFromAuthInfo(authInfo),
  }

  registerQueryTools(server, toolDeps, callerFromAuthInfo(authInfo))
  registerTriagePrompt(server, toolDeps)

  return server
}
