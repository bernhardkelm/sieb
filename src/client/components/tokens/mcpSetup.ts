/**
 * Builds the Claude Code command that registers sieb as MCP server for the user, with the token
 * as bearer header.
 * @param {string} mcpUrl - Absolute URL of the MCP endpoint
 * @param {string} secret - Token secret
 * @returns {string} - claude mcp add command
 */
export const mcpAddCommand = (mcpUrl: string, secret: string): string =>
  `claude mcp add --transport http --scope user sieb ${mcpUrl} --header "Authorization: Bearer ${secret}"`

/**
 * Returns the MCP endpoint on the origin of the page, used while the server info is missing.
 * @param {string} origin - Page origin
 * @returns {string} - MCP URL
 */
export const fallbackMcpUrl = (origin: string): string => `${origin}/mcp`
