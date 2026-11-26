/** Scopes a caller can hold on the MCP endpoint, `sieb:propose` implies `sieb:read` */
export const MCP_SCOPES = ['sieb:read', 'sieb:propose'] as const

export type McpScope = (typeof MCP_SCOPES)[number]

/** How a caller authenticated: a personal sieb token or an authentik OAuth access token */
export type McpAuthVia = 'token' | 'oauth'

/** Authenticated caller of an MCP request, built from the bearer token's AuthInfo */
export interface McpCaller {
  actor: string // sieb username the caller acts for, token owner or preferred_username
  via: McpAuthVia
  tokenId: number | null // personal token id, null for OAuth
  clientLabel: string // token name or the configured OAuth client label
  scopes: McpScope[]
}

/**
 * Returns whether a caller may file proposals and so sees propose_decision.
 * @param {Pick<McpCaller, 'scopes'>} caller - Authenticated caller
 * @returns {boolean} - True with the sieb:propose scope
 */
export const canPropose = (caller: Pick<McpCaller, 'scopes'>): boolean =>
  caller.scopes.includes('sieb:propose')
