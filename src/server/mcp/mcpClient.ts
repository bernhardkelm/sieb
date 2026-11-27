import type { AuthInfo } from '@modelcontextprotocol/server'

import { USER_AGENT_MAX, type McpClientHints } from '#core/proposalClient.ts'

/** clientInfo name of Claude Code: the CLI, the Code tab of the Claude app and the IDE extensions */
export const CLAUDE_CODE_CLIENT = 'claude-code'

const CLIENT_NAME_KEY = 'mcpClientName'

const USER_AGENT_KEY = 'mcpUserAgent'

/**
 * Returns the AuthInfo of a request with what it tells about its client, the one value a
 * stateless server factory gets per request. The User-Agent is cut to USER_AGENT_MAX characters.
 * @param {AuthInfo} authInfo - Verified token information
 * @param {McpClientHints} hints - clientInfo name and User-Agent, null when absent
 * @returns {AuthInfo} - AuthInfo carrying both in extra
 */
export const withClient = (
  authInfo: AuthInfo,
  { clientName, userAgent }: McpClientHints,
): AuthInfo => ({
  ...authInfo,
  extra: {
    ...authInfo.extra,
    [CLIENT_NAME_KEY]: clientName,
    [USER_AGENT_KEY]: userAgent === null ? null : userAgent.slice(0, USER_AGENT_MAX),
  },
})

/**
 * Reads a string value from the extra of an AuthInfo.
 * @param {AuthInfo} authInfo - AuthInfo
 * @param {string} key - Extra key
 * @returns {string | null} - Value, null when absent or not a string
 */
const extraString = (authInfo: AuthInfo, key: string): string | null => {
  const value = authInfo.extra?.[key]

  return typeof value === 'string' ? value : null
}

/**
 * Returns the client hints withClient put into an AuthInfo.
 * @param {AuthInfo} authInfo - AuthInfo built by withClient
 * @returns {McpClientHints} - clientInfo name and User-Agent, null when absent
 */
export const clientHintsOf = (authInfo: AuthInfo): McpClientHints => ({
  clientName: extraString(authInfo, CLIENT_NAME_KEY),
  userAgent: extraString(authInfo, USER_AGENT_KEY),
})

/**
 * Returns whether the handshake of a request came from Claude Code, which runs in a working
 * directory that may hold the repository of an own image.
 * @param {AuthInfo} authInfo - AuthInfo built by withClient
 * @returns {boolean} - True for the clientInfo name claude-code
 */
export const isClaudeCodeClient = (authInfo: AuthInfo): boolean =>
  extraString(authInfo, CLIENT_NAME_KEY)?.toLowerCase() === CLAUDE_CODE_CLIENT
