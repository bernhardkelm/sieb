/** Kind of Claude client that filed a proposal, derived by sieb and never taken from free text */
export const PROPOSAL_CLIENT_KINDS = [
  'claude_app',
  'claude_code',
  'claude_code_cli',
  'claude_code_headless',
  'claude_code_vscode',
  'claude_code_app',
  'auto_check',
] as const

export type ProposalClientKind = (typeof PROPOSAL_CLIENT_KINDS)[number]

/** What a request tells about its client: the MCP clientInfo name and the User-Agent header */
export interface McpClientHints {
  clientName: string | null
  userAgent: string | null
}

/** User-Agent characters sieb keeps, longer headers are cut before parsing or storing */
export const USER_AGENT_MAX = 200

/** clientInfo name of the claude.ai connector, shared by web, desktop and mobile chats */
const CLAUDE_APP_CLIENT = 'anthropic/claudeai'

const CLAUDE_CODE_CLIENT = 'claude-code'

/** claude-code/<version> (<entrypoint>[, ...]), the entrypoint Claude Code reports itself */
const CLAUDE_CODE_USER_AGENT = /^claude-code\/[0-9][\w.+-]{0,40}(?: \(([a-z0-9-]{1,40})[,)])?/

const ENTRYPOINT_KINDS: Readonly<Record<string, ProposalClientKind>> = {
  cli: 'claude_code_cli',
  'sdk-cli': 'claude_code_headless',
  'sdk-ts': 'claude_code_headless',
  'sdk-py': 'claude_code_headless',
  'claude-vscode': 'claude_code_vscode',
  'claude-desktop': 'claude_code_app',
}

const KINDS: readonly string[] = PROPOSAL_CLIENT_KINDS

/**
 * Returns the Claude Code kind a User-Agent names, from its entrypoint.
 * @param {string} userAgent - User-Agent, already capped
 * @returns {ProposalClientKind | null} - Claude Code kind, null when it is not Claude Code's
 */
const claudeCodeKindOf = (userAgent: string): ProposalClientKind | null => {
  const match = CLAUDE_CODE_USER_AGENT.exec(userAgent)

  if (match === null) {
    return null
  }

  const entrypoint = match[1]

  return (entrypoint === undefined ? undefined : ENTRYPOINT_KINDS[entrypoint]) ?? 'claude_code'
}

/**
 * Derives the client kind of a proposal: an Auto-check token first, then the entrypoint in
 * Claude Code's User-Agent, then the clientInfo name. Only the documented patterns count, any
 * other value gives null so the proposer's client label shows instead.
 * @param {McpClientHints} hints - clientInfo name and User-Agent of the request, both untrusted
 * @param {boolean} autoCheck - Whether the token of an Auto-check filed it
 * @returns {ProposalClientKind | null} - Client kind, null when unknown
 */
export const proposalClientKind = (
  { clientName, userAgent }: McpClientHints,
  autoCheck: boolean,
): ProposalClientKind | null => {
  if (autoCheck) {
    return 'auto_check'
  }

  const fromAgent = userAgent === null ? null : claudeCodeKindOf(userAgent.slice(0, USER_AGENT_MAX))

  if (fromAgent !== null) {
    return fromAgent
  }

  const name = clientName?.trim().toLowerCase() ?? null

  if (name === CLAUDE_CODE_CLIENT) {
    return 'claude_code'
  }

  return name === CLAUDE_APP_CLIENT ? 'claude_app' : null
}

/**
 * Reads a stored client kind, a value this version does not know reads as unknown.
 * @param {string | null} value - Column value
 * @returns {ProposalClientKind | null} - Client kind, null for NULL and unknown values
 */
export const storedClientKind = (value: string | null): ProposalClientKind | null =>
  value !== null && KINDS.includes(value) ? (value as ProposalClientKind) : null
