import type { CommandOutput, CommandOptions, ExecCommand } from '#checker/inspect/execCommand.ts'

/** Command output read before filtering by a pattern */
export const FILTER_INPUT_BYTES = 32 * 1024 * 1024

/** How lines are matched, plain text unless regex is set */
export interface LineFilter {
  pattern: string
  regex?: boolean
  ignoreCase?: boolean
}

/** What the filter needs to run grep */
export interface FilterDeps {
  exec: ExecCommand
  limits: Omit<CommandOptions, 'maxBytes' | 'input'>
  maxBytes: number
}

/**
 * Keeps the lines of command output that match a filter: plain text in Node, or an extended
 * regular expression through grep -E.
 * @param {FilterDeps} deps - Command runner and limits
 * @param {CommandOutput} all - Command output to filter
 * @param {LineFilter} filter - Pattern and matching mode
 * @returns {Promise<{ tool: string, output: CommandOutput }>} - Filtered output and the command that produced it
 */
export const filterLines = async (
  deps: FilterDeps,
  all: CommandOutput,
  { pattern, regex = false, ignoreCase = false }: LineFilter,
): Promise<{ tool: string; output: CommandOutput }> => {
  if (regex) {
    const flags = ignoreCase ? ['-E', '-i'] : ['-E']
    const grep = { ...deps.limits, maxBytes: FILTER_INPUT_BYTES, input: all.stdout }

    return { tool: 'grep', output: await deps.exec('grep', [...flags, '-e', pattern, '-'], grep) }
  }

  const needle = ignoreCase ? pattern.toLowerCase() : pattern
  const lines = all.stdout
    .toString('utf8')
    .split('\n')
    .filter((line) => (ignoreCase ? line.toLowerCase() : line).includes(needle))

  return {
    tool: 'filter',
    output: { ...all, stdout: Buffer.from(lines.join('\n')), truncated: false, code: 0 },
  }
}
