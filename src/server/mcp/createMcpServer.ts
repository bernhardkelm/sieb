import { McpServer, type AuthInfo } from '@modelcontextprotocol/server'

import { proposalClientKind } from '#core/proposalClient.ts'

import { baseUrlFromAuthInfo } from '#server/mcp/baseUrlFromAuthInfo.ts'
import { callerFromAuthInfo } from '#server/mcp/callerFromAuthInfo.ts'
import { canPropose } from '#server/mcp/mcpCaller.ts'
import { clientHintsOf, isClaudeCodeClient } from '#server/mcp/mcpClient.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'
import { serverInstructions } from '#server/mcp/serverInstructions.ts'
import { registerProposeDecisionTool } from '#server/mcp/tools/proposeDecisionTool.ts'
import { registerQueryTools } from '#server/mcp/tools/registerQueryTools.ts'
import { registerTriagePrompt } from '#server/mcp/triagePrompt.ts'

/**
 * Creates the MCP server of one request: the read-only query tools for the caller, with the
 * sieb:propose scope also propose_decision, and the triage prompt, with the server instructions
 * that explain sieb to the model, for Claude Code with the hint to look for the repository of an
 * own image. The token of an Auto-check gets the tools bound to its check, see registerQueryTools.
 * Proposals record the client kind the request's client hints name.
 * Links use the origin of the resource the token was verified for.
 * @param {Omit<McpToolDeps, 'baseUrl'>} deps - Database, clock, KEV source, registries, logger and proposal limiter
 * @param {AuthInfo} authInfo - Verified token information of the request
 * @param {string} version - sieb version reported in serverInfo
 * @returns {McpServer} - Server, connected to a transport by the handler
 */
export const createMcpServer = (
  deps: Omit<McpToolDeps, 'baseUrl'>,
  authInfo: AuthInfo,
  version: string,
): McpServer => {
  const caller = callerFromAuthInfo(authInfo)
  const proposing = canPropose(caller)
  const server = new McpServer(
    { name: 'sieb', version },
    {
      instructions: serverInstructions(
        proposing,
        isClaudeCodeClient(authInfo),
        caller.check !== null,
      ),
    },
  )
  const toolDeps: McpToolDeps = {
    db: deps.db,
    clock: deps.clock,
    kevSource: deps.kevSource,
    publicRegistries: deps.publicRegistries,
    credentialVault: deps.credentialVault ?? null,
    pullProber: deps.pullProber ?? null,
    log: deps.log,
    proposalLimiter: deps.proposalLimiter,
    checksEnabled: deps.checksEnabled ?? false,
    baseUrl: baseUrlFromAuthInfo(authInfo),
  }

  registerQueryTools(server, toolDeps, caller)
  if (proposing) {
    registerProposeDecisionTool(
      server,
      toolDeps,
      caller,
      proposalClientKind(clientHintsOf(authInfo), caller.check !== null),
    )
  }

  registerTriagePrompt(server, toolDeps, proposing)

  return server
}
