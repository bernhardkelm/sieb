import type { AuthInfo } from '@modelcontextprotocol/server'

/** clientInfo name of Claude Code: the CLI, the Code tab of the desktop app and the IDE extensions */
export const CLAUDE_CODE_CLIENT = 'claude-code'

const CLIENT_NAME_KEY = 'mcpClientName'

/**
 * Returns the AuthInfo of a request with the clientInfo name of its handshake, the one value a
 * stateless server factory gets per request.
 * @param {AuthInfo} authInfo - Verified token information
 * @param {string | null} clientName - clientInfo name, null outside a handshake or without one
 * @returns {AuthInfo} - AuthInfo carrying the client name in extra
 */
export const withClientName = (authInfo: AuthInfo, clientName: string | null): AuthInfo => ({
  ...authInfo,
  extra: { ...authInfo.extra, [CLIENT_NAME_KEY]: clientName },
})

/**
 * Returns whether the handshake of a request came from Claude Code, which runs in a working
 * directory that may hold the repository of an own image.
 * @param {AuthInfo} authInfo - AuthInfo built by withClientName
 * @returns {boolean} - True for the clientInfo name claude-code
 */
export const isClaudeCodeClient = (authInfo: AuthInfo): boolean => {
  const name = authInfo.extra?.[CLIENT_NAME_KEY]

  return typeof name === 'string' && name.toLowerCase() === CLAUDE_CODE_CLIENT
}
