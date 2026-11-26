import type { AuthInfo } from '@modelcontextprotocol/server'

import type { McpAuthVia, McpCaller, McpScope } from '#server/mcp/mcpCaller.ts'

const SCOPES: readonly string[] = ['sieb:read', 'sieb:propose'] satisfies McpScope[]
const VIAS: readonly string[] = ['token', 'oauth'] satisfies McpAuthVia[]

/**
 * Builds the MCP caller from the AuthInfo a bearer verifier produced.
 * @param {AuthInfo | undefined} authInfo - Verified token information
 * @returns {McpCaller} - Caller with the sieb scopes of the token
 * @throws {Error} - When the AuthInfo lacks the actor, via, token id or client label
 */
export const callerFromAuthInfo = (authInfo: AuthInfo | undefined): McpCaller => {
  const extra = authInfo?.extra ?? {}
  const { actor, via, tokenId, clientLabel } = extra

  if (
    typeof actor !== 'string' ||
    actor === '' ||
    typeof via !== 'string' ||
    !VIAS.includes(via) ||
    !(tokenId === null || typeof tokenId === 'number') ||
    typeof clientLabel !== 'string'
  ) {
    throw new Error('MCP request without a verified caller')
  }

  return {
    actor,
    via: via as McpAuthVia,
    tokenId,
    clientLabel,
    scopes: (authInfo?.scopes ?? []).filter((scope) => SCOPES.includes(scope)) as McpScope[],
  }
}
