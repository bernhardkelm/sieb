import {
  bearerAuthChallengeResponse,
  OAuthError,
  OAuthErrorCode,
  verifyBearerToken,
  type AuthInfo,
  type VerifyBearerTokenOptions,
} from '@modelcontextprotocol/server'

import { MCP_SCOPES, type McpScope } from '#server/mcp/mcpCaller.ts'

/** Scopes every /mcp request needs, propose_decision additionally needs sieb:propose */
export const MCP_REQUIRED_SCOPES: readonly McpScope[] = ['sieb:read']

export type McpBearerGateOptions = Omit<VerifyBearerTokenOptions, 'requiredScopes'>

/**
 * Returns the scopes a refusal names: every MCP scope on a 401, since clients request the
 * challenge scope when they authorize, and the scopes every request needs on a 403.
 * @param {unknown} error - Error thrown by the bearer verification
 * @returns {string[]} - Scopes for the scope parameter of the challenge
 */
const challengeScopesOf = (error: unknown): string[] =>
  error instanceof OAuthError && error.code === OAuthErrorCode.InvalidToken
    ? [...MCP_SCOPES]
    : [...MCP_REQUIRED_SCOPES]

/**
 * Creates the bearer gate of /mcp. It accepts the same tokens as the SDK's requireBearerAuth
 * with MCP_REQUIRED_SCOPES, but a missing or invalid token is challenged with every MCP scope,
 * so an OAuth client asks for sieb:propose on its first authorization, where requireBearerAuth
 * would name only the required scopes.
 * @param {McpBearerGateOptions} options - Verifier, expected resource and metadata URL
 * @returns {(request: Request) => Promise<AuthInfo | Response>} - Verified token or the refusal
 */
export const createMcpBearerGate = (
  options: McpBearerGateOptions,
): ((request: Request) => Promise<AuthInfo | Response>) => {
  const verifyOptions = { ...options, requiredScopes: [...MCP_REQUIRED_SCOPES] }

  return async (request) => {
    const [header] = (request.headers.get('authorization') ?? '').split(',')

    try {
      return await verifyBearerToken(header || undefined, verifyOptions)
    } catch (error) {
      return bearerAuthChallengeResponse(error, {
        ...options,
        requiredScopes: challengeScopesOf(error),
      })
    }
  }
}
