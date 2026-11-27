import { INSPECT_SERVER_NAME } from '#checker/inspect/createInspectServer.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'

/** Name of the sieb server in the MCP config, its tools are mcp__sieb__<tool> */
export const MCP_SERVER_NAME = 'sieb'

/**
 * Returns the tool uses that run without approval, everything else that needs approval is
 * denied: the sieb and inspect tools, WebSearch, and WebFetch only for the given hosts.
 * @param {string[]} webDomains - Hosts WebFetch may reach
 * @returns {string[]} - Permission allow rules
 */
export const allowRules = (webDomains: string[]): string[] => [
  `mcp__${MCP_SERVER_NAME}__*`,
  `mcp__${INSPECT_SERVER_NAME}__*`,
  ...webDomains.map((domain) => `WebFetch(domain:${domain})`),
  'WebSearch',
]

// absolute paths in the //path form of Read rules
const OUTSIDE_PATHS = [
  '/proc',
  '/sys',
  '/dev',
  '/run',
  '/var/run',
  '/etc',
  '/home',
  '/root',
  '/tmp',
]

/**
 * Returns the Read deny rule for an absolute directory and everything below it.
 * @param {string} path - Absolute path
 * @returns {string} - Rule in the //path form
 */
const denyTree = (path: string): string => `Read(/${path}/**)`

/**
 * Builds the settings file of a check: dontAsk mode with an explicit allow list, so every other
 * call is denied instead of prompted, no shell, file tools confined to the workspace, no writes,
 * WebFetch limited to the allowed hosts, and the check's MCP config and settings unreadable.
 * @param {CheckLayout} layout - Check paths
 * @param {string[]} webDomains - Hosts WebFetch may reach
 * @returns {Record<string, unknown>} - Settings JSON for --settings
 */
export const claudeSettings = (
  layout: CheckLayout,
  webDomains: string[],
): Record<string, unknown> => ({
  permissions: {
    defaultMode: 'dontAsk',
    disableBypassPermissionsMode: 'disable',
    blockReadsOutsideWorkingDirectories: true,
    blockWritesOutsideWorkingDirectories: true,
    allow: allowRules(webDomains),
    deny: [
      'Bash',
      'Edit',
      'Write',
      'NotebookEdit',
      ...OUTSIDE_PATHS.map(denyTree),
      `Read(/${layout.mcpConfig})`,
      `Read(/${layout.settings})`,
    ],
  },
  disableAllHooks: true,
  autoMemoryEnabled: false,
  disableBundledSkills: true,
  disableSkillShellExecution: true,
})
