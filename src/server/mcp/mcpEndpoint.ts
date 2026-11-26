import {
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
  type AuthInfo,
  type McpServer,
} from '@modelcontextprotocol/server'

import { MCP_MAX_BODY_BYTES } from '#server/mcp/mcpGuards.ts'

export interface McpEndpoint {
  /**
   * Serves one authenticated MCP request.
   * @param {Request} request - Request, body not yet read
   * @param {AuthInfo} authInfo - Verified token information
   * @returns {Promise<Response>} - JSON-RPC answer
   */
  fetch: (request: Request, authInfo: AuthInfo) => Promise<Response>
}

/**
 * Serves a 2025-era request statelessly with a JSON answer instead of an SSE stream. GET and
 * DELETE are session operations a stateless endpoint does not offer.
 * @param {McpServer} server - Fresh server of this request
 * @param {Request} request - Request
 * @param {AuthInfo} authInfo - Verified token information
 * @returns {Promise<Response>} - JSON-RPC answer
 */
const serveLegacy = async (
  server: McpServer,
  request: Request,
  authInfo: AuthInfo,
): Promise<Response> => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MCP_MAX_BODY_BYTES,
  })

  await server.connect(transport)

  try {
    return await transport.handleRequest(request, { authInfo })
  } finally {
    await transport.close()
    await server.close()
  }
}

/**
 * Creates the stateless MCP endpoint with JSON answers for both protocol eras: 2026-07-28
 * requests through createMcpHandler in json mode, 2025-era requests through a per-request
 * streamable HTTP transport, both from the same server factory.
 * @param {(authInfo: AuthInfo) => McpServer} factory - Creates the server of one request
 * @param {(message: string) => void} log - Logger for rejected and failed requests
 * @returns {McpEndpoint} - Endpoint
 */
export const createMcpEndpoint = (
  factory: (authInfo: AuthInfo) => McpServer,
  log: (message: string) => void,
): McpEndpoint => {
  const modern = createMcpHandler(
    ({ authInfo }) => {
      if (authInfo === undefined) {
        throw new Error('MCP request without AuthInfo')
      }

      return factory(authInfo)
    },
    {
      legacy: 'reject',
      responseMode: 'json',
      maxRequestBodySize: MCP_MAX_BODY_BYTES,
      onerror: (error) => log(`[sieb] MCP request failed: ${error.message}`),
    },
  )

  return {
    fetch: async (request, authInfo) => {
      if (request.method !== 'POST') {
        return Response.json(
          { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
          { status: 405, headers: { Allow: 'POST' } },
        )
      }

      if (await isLegacyRequest(request, undefined, { maxRequestBodySize: MCP_MAX_BODY_BYTES })) {
        return serveLegacy(factory(authInfo), request, authInfo)
      }

      return modern.fetch(request, { authInfo })
    },
  }
}
