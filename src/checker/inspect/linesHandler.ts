import type { CallToolResult } from '@modelcontextprotocol/server'

import { errorMessage } from '#core/errorMessage.ts'
import type { CommandOptions, ExecCommand } from '#checker/inspect/execCommand.ts'
import { commandResult, toolError } from '#checker/inspect/inspectResult.ts'
import { FILTER_INPUT_BYTES, filterLines, type LineFilter } from '#checker/inspect/patternFilter.ts'

/** What a line output handler needs */
export interface LinesDeps {
  exec: ExecCommand
  limits: Omit<CommandOptions, 'maxBytes' | 'input'>
  maxBytes: number
}

/**
 * Runs a command with line output, optionally keeps only matching lines before the output cap,
 * and says how many lines the cap dropped.
 * @param {LinesDeps} deps - Command runner and limits
 * @param {string} tool - Command name
 * @param {string[]} args - Command arguments
 * @param {LineFilter | undefined} filter - Line filter, none keeps every line
 * @returns {Promise<CallToolResult>} - Tool result
 */
/**
 * Counts the lines of command output, with or without a final newline.
 * @param {string} text - Output text
 * @returns {number} - Number of lines
 */
const lineCount = (text: string): number =>
  text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

export const runLines = async (
  deps: LinesDeps,
  tool: string,
  args: string[],
  filter: LineFilter | undefined,
): Promise<CallToolResult> => {
  const limits = { timeoutMs: deps.limits.timeoutMs, maxBytes: deps.maxBytes }

  try {
    const all = await deps.exec(tool, args, { ...deps.limits, maxBytes: FILTER_INPUT_BYTES })

    if (all.timedOut || (!all.truncated && all.code !== 0)) {
      return commandResult(tool, all, limits)
    }

    const filtered = filter ? await filterLines(deps, all, filter) : { tool, output: all }
    const note = all.truncated
      ? `\n[${tool} output cut at ${FILTER_INPUT_BYTES} bytes before filtering, later lines are missing]`
      : ''
    const okCodes = filtered.tool === 'grep' ? [0, 1] : [0]

    if (filtered.output.stdout.length <= deps.maxBytes) {
      return commandResult(filtered.tool, filtered.output, limits, okCodes, note)
    }

    const text = filtered.output.stdout.toString('utf8')
    const kept = text.slice(0, text.lastIndexOf('\n', deps.maxBytes) + 1 || deps.maxBytes)
    const dropped = lineCount(text) - lineCount(kept)
    const hint = filter ? 'narrow the pattern' : 'add a pattern'
    const cut = `\n[output truncated at ${deps.maxBytes} bytes, ${dropped} lines dropped, ${hint}]${note}`

    return { content: [{ type: 'text', text: `${kept.replace(/\n$/u, '')}${cut}` }] }
  } catch (error) {
    return toolError(errorMessage(error))
  }
}
