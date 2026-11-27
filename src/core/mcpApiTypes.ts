/** Answer of GET /api/mcp-info, also while MCP is disabled so the UI can hide it */
export interface McpInfoResponse {
  enabled: boolean // SIEB_MCP_ENABLED
  mcpUrl: string | null // absolute URL of the MCP endpoint, null while disabled
  oauth: boolean // whether claude.ai connectors can sign in through OAuth, false while disabled
  claude: ClaudeConnection | null // acting user's connection, null while disabled or anonymous
  checksEnabled?: boolean // SIEB_CHECKS_ENABLED, always sent by this server, absent counts as off
}

/** Whether Claude can reach sieb for the acting user */
export interface ClaudeConnection {
  connected: boolean // a live token, or an OAuth MCP request within the last 30 days
  activeTokens: number // personal tokens neither revoked nor expired
  oauthLastSeenAt: string | null // last OAuth authenticated MCP request, any age
}
