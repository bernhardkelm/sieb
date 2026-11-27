import type { WorkerClaim } from '#core/check.ts'
import type { ClaudeCredential } from '#checker/checkerConfig.ts'
import { allowRules, MCP_SERVER_NAME } from '#checker/claude/claudeSettings.ts'
import { INSPECT_SERVER_NAME } from '#checker/inspect/createInspectServer.ts'
import { INSPECT_ENTRY } from '#checker/inspect/inspectEntry.ts'
import { INPUT_FD } from '#checker/process/processRunner.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'

/** Built-in tools Claude gets, everything else such as Bash, Edit, Write and Agent is absent */
export const CLAUDE_TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']

// documented Claude Code variables: no telemetry, updates, CLAUDE.md files or transcripts
// Claude Code 2.1.326 reads the credential once from this descriptor, verified with auth status
const CREDENTIAL_FD_VARIABLES: Record<ClaudeCredential['kind'], string> = {
  oauth_token: 'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',
  api_key: 'CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR',
}

const QUIET_ENV: Record<string, string> = {
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  DISABLE_TELEMETRY: '1',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_AUTOUPDATER: '1',
  CLAUDE_CODE_DISABLE_TERMINAL_TITLE: '1',
  CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
  CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1',
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
  CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1',
  ENABLE_TOOL_SEARCH: 'false',
}

/**
 * Builds the MCP config of a check: sieb, authenticated with the check token, and the local
 * inspect server for the workspace, started with PATH as its only variable.
 * @param {WorkerClaim} claim - Claimed check
 * @param {CheckLayout} layout - Check paths
 * @param {string} path - PATH of the inspect server
 * @returns {Record<string, unknown>} - JSON for --mcp-config
 */
export const mcpConfig = (
  claim: WorkerClaim,
  layout: CheckLayout,
  path: string,
): Record<string, unknown> => ({
  mcpServers: {
    [MCP_SERVER_NAME]: {
      type: 'http',
      url: claim.mcpUrl,
      headers: { Authorization: `Bearer ${claim.token}` },
    },
    [INSPECT_SERVER_NAME]: {
      type: 'stdio',
      command: process.execPath,
      args: [INSPECT_ENTRY, layout.workspace],
      env: { PATH: path },
    },
  },
})

/**
 * Builds the claude command line, prompt first so no variadic option can swallow it.
 * @param {string} prompt - Full prompt
 * @param {CheckLayout} layout - Check paths
 * @param {number} maxTurns - Turn limit of the check
 * @param {string[]} webDomains - Hosts WebFetch may reach
 * @returns {string[]} - Arguments after the claude binary
 */
export const claudeArgs = (
  prompt: string,
  layout: CheckLayout,
  maxTurns: number,
  webDomains: string[],
): string[] => [
  '-p',
  // a leading dash would be parsed as an option
  prompt.startsWith('-') ? `\n${prompt}` : prompt,
  '--output-format',
  'json',
  '--mcp-config',
  layout.mcpConfig,
  '--strict-mcp-config',
  '--max-turns',
  String(maxTurns),
  '--settings',
  layout.settings,
  '--permission-mode',
  'dontAsk',
  '--tools',
  CLAUDE_TOOLS.join(','),
  '--allowedTools',
  allowRules(webDomains).join(','),
  '--disable-slash-commands',
  '--no-session-persistence',
]

/**
 * Builds Claude's environment from scratch: PATH, the check HOME and TMPDIR, the quiet variables
 * and the variable that names the descriptor the credential arrives on. The credential itself is
 * handed over on that descriptor, so it is in neither the environment nor the command line.
 * @param {ClaudeCredential['kind']} kind - Subscription token or API key
 * @param {string} path - PATH of Claude
 * @param {CheckLayout} layout - Check paths
 * @returns {Record<string, string>} - Environment
 */
export const claudeEnv = (
  kind: ClaudeCredential['kind'],
  path: string,
  layout: CheckLayout,
): Record<string, string> => ({
  PATH: path,
  HOME: layout.home,
  TMPDIR: layout.tmp,
  CLAUDE_CODE_TMPDIR: layout.tmp,
  [CREDENTIAL_FD_VARIABLES[kind]]: String(INPUT_FD),
  ...QUIET_ENV,
})
