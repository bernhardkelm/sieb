import { logSafe } from '#server/logSafe.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'

const HANDSHAKE_METHODS: readonly string[] = ['initialize', 'server/discover']

/**
 * Returns the JSON-RPC method of a message when it opens a connection.
 * @param {unknown} message - Parsed JSON-RPC message
 * @returns {string | null} - initialize or server/discover, null for any other message
 */
const handshakeOf = (message: unknown): string | null => {
  const method =
    typeof message === 'object' && message !== null && 'method' in message ? message.method : null

  return typeof method === 'string' && HANDSHAKE_METHODS.includes(method) ? method : null
}

/**
 * Reads whether an MCP request opens a connection: initialize of the 2025 era or server/discover
 * of the 2026-07-28 revision, also inside a batch. The body is read from a clone.
 * @param {Request} request - MCP request, body not yet read
 * @returns {Promise<string | null>} - Handshake method, null for other requests and unreadable bodies
 */
export const handshakeMethod = async (request: Request): Promise<string | null> => {
  if (request.method !== 'POST') {
    return null
  }

  try {
    const body: unknown = await request.clone().json()
    const messages: unknown[] = Array.isArray(body) ? body : [body]

    return messages.map(handshakeOf).find((method) => method !== null) ?? null
  } catch {
    return null
  }
}

/**
 * Builds the log line of a connection handshake with the caller and its scopes, never a token.
 * @param {McpCaller} caller - Authenticated caller
 * @param {string} method - Handshake method
 * @returns {string} - Log line
 */
export const handshakeLogLine = (caller: McpCaller, method: string): string => {
  const token = caller.tokenId === null ? '' : ` ${caller.tokenId}`
  const scopes = caller.scopes.length === 0 ? 'none' : caller.scopes.join(' ')

  return (
    `[sieb] MCP ${method} by ${logSafe(caller.actor)} via ${caller.via}${token}` +
    ` (${logSafe(caller.clientLabel)}), scopes ${scopes}`
  )
}
