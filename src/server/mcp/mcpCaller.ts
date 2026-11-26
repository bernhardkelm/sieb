/** Scope a caller holds on the MCP endpoint, `sieb:propose` implies `sieb:read` */
export type McpScope = 'sieb:read' | 'sieb:propose'

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
