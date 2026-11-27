/** Effort levels Claude Code accepts for --effort */
export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type ClaudeEffort = (typeof CLAUDE_EFFORTS)[number]

/**
 * Parses SIEB_CHECKER_EFFORT, the effort level passed to Claude Code.
 * @param {string | undefined} value - Raw variable
 * @returns {ClaudeEffort | null} - Level, null when unset or blank to keep Claude Code's default
 * @throws {Error} - When the value is no known level
 */
export const parseClaudeEffort = (value: string | undefined): ClaudeEffort | null => {
  const effort = value?.trim().toLowerCase() || null

  if (effort === null) {
    return null
  }

  const level = CLAUDE_EFFORTS.find((candidate) => candidate === effort)

  if (level === undefined) {
    throw new Error(
      `SIEB_CHECKER_EFFORT must be one of ${CLAUDE_EFFORTS.join(', ')}, got "${effort}"`,
    )
  }

  return level
}
