import { chmod, writeFile } from 'node:fs/promises'

import type { WorkerClaim } from '#core/check.ts'
import type { CheckerConfig } from '#checker/checkerConfig.ts'
import { mcpConfig } from '#checker/claude/claudeInvocation.ts'
import { claudeSettings } from '#checker/claude/claudeSettings.ts'
import type { CheckLayout } from '#checker/workspace/checkLayout.ts'

/**
 * Writes Claude's files outside the workspace: the MCP config with the sieb token (mode 600)
 * and the permission settings.
 * @param {WorkerClaim} claim - Claimed check
 * @param {CheckLayout} layout - Check paths
 * @param {CheckerConfig} config - Worker configuration
 * @returns {Promise<void>}
 */
export const writeClaudeFiles = async (
  claim: WorkerClaim,
  layout: CheckLayout,
  config: CheckerConfig,
): Promise<void> => {
  await writeFile(layout.mcpConfig, JSON.stringify(mcpConfig(claim, layout, config.path)), {
    mode: 0o600,
  })
  await chmod(layout.mcpConfig, 0o600)
  await writeFile(
    layout.settings,
    JSON.stringify(claudeSettings(layout, config.webDomains), null, 2),
  )
}
