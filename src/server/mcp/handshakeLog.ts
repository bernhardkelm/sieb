import { CLIENT_INFO_META_KEY } from '@modelcontextprotocol/server'

import { logSafe } from '#server/logSafe.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'

const HANDSHAKE_METHODS: readonly string[] = ['initialize', 'server/discover']

/** Handshake message of a request: its method and the clientInfo name the client sent */
export interface Handshake {
  method: string
  clientName: string | null
}

/**
 * Returns the value of a key when the value is a plain object.
 * @param {unknown} value - Parsed JSON value
 * @param {string} key - Key
 * @returns {unknown} - Value of the key, undefined for anything else
 */
const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined

/**
 * Reads the client name of a handshake: params.clientInfo of initialize, the clientInfo key of
 * the params._meta envelope of the 2026-07-28 revision.
 * @param {unknown} params - Params of the handshake message
 * @returns {string | null} - Client name, null without one
 */
const clientNameOf = (params: unknown): string | null => {
  const info = field(params, 'clientInfo') ?? field(field(params, '_meta'), CLIENT_INFO_META_KEY)
  const name = field(info, 'name')

  return typeof name === 'string' && name.trim() !== '' ? name.trim() : null
}

/**
 * Returns the handshake of a message when it opens a connection.
 * @param {unknown} message - Parsed JSON-RPC message
 * @returns {Handshake | null} - Method and client name, null for any other message
 */
const handshakeOf = (message: unknown): Handshake | null => {
  const method = field(message, 'method')

  return typeof method === 'string' && HANDSHAKE_METHODS.includes(method)
    ? { method, clientName: clientNameOf(field(message, 'params')) }
    : null
}

/**
 * Reads whether an MCP request opens a connection: initialize of the 2025 era or server/discover
 * of the 2026-07-28 revision, also inside a batch. The body is read from a clone.
 * @param {Request} request - MCP request, body not yet read
 * @returns {Promise<Handshake | null>} - Handshake, null for other requests and unreadable bodies
 */
export const readHandshake = async (request: Request): Promise<Handshake | null> => {
  if (request.method !== 'POST') {
    return null
  }

  try {
    const body: unknown = await request.clone().json()
    const messages: unknown[] = Array.isArray(body) ? body : [body]

    return messages.map(handshakeOf).find((handshake) => handshake !== null) ?? null
  } catch {
    return null
  }
}

/**
 * Builds the log line of a connection handshake with the caller, its scopes and the client
 * name, never a token.
 * @param {McpCaller} caller - Authenticated caller
 * @param {Handshake} handshake - Handshake method and client name
 * @returns {string} - Log line
 */
export const handshakeLogLine = (caller: McpCaller, { method, clientName }: Handshake): string => {
  const token = caller.tokenId === null ? '' : ` ${caller.tokenId}`
  const scopes = caller.scopes.length === 0 ? 'none' : caller.scopes.join(' ')
  const client = clientName === null ? '' : ` from ${logSafe(clientName)}`

  return (
    `[sieb] MCP ${method} by ${logSafe(caller.actor)} via ${caller.via}${token}` +
    ` (${logSafe(caller.clientLabel)})${client}, scopes ${scopes}`
  )
}
