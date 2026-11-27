import type { AuthInfo } from '@modelcontextprotocol/server'

import {
  MCP_SCOPES,
  type CheckScope,
  type McpAuthVia,
  type McpCaller,
  type McpScope,
} from '#server/mcp/mcpCaller.ts'

const SCOPES: readonly string[] = MCP_SCOPES
const VIAS: readonly string[] = ['token', 'oauth'] satisfies McpAuthVia[]

/**
 * Reads the check scope a personal token verifier put into the AuthInfo.
 * @param {unknown} value - Raw extra.check value
 * @returns {CheckScope | null} - Scope, null when absent
 * @throws {Error} - When present but malformed
 */
const readCheckScope = (value: unknown): CheckScope | null => {
  if (value === undefined || value === null) {
    return null
  }

  const scope = value as Partial<CheckScope>

  if (
    typeof scope.checkId !== 'number' ||
    typeof scope.findingId !== 'number' ||
    typeof scope.vulnId !== 'string' ||
    typeof scope.imageRef !== 'string'
  ) {
    throw new Error('MCP request with a malformed check scope')
  }

  return {
    checkId: scope.checkId,
    findingId: scope.findingId,
    vulnId: scope.vulnId,
    imageRef: scope.imageRef,
  }
}

/**
 * Builds the MCP caller from the AuthInfo a bearer verifier produced.
 * @param {AuthInfo | undefined} authInfo - Verified token information
 * @returns {McpCaller} - Caller with the sieb scopes of the token
 * @throws {Error} - When the AuthInfo lacks the actor, via, token id or client label, or has a malformed check scope
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
    check: readCheckScope(extra.check),
  }
}
