import type { CallToolResult } from '@modelcontextprotocol/server'

import type { CommandOptions, ExecCommand } from '#checker/inspect/execCommand.ts'
import { stringsArgs } from '#checker/inspect/inspectArgs.ts'
import { commandResult, toolError } from '#checker/inspect/inspectResult.ts'
import { FILTER_INPUT_BYTES, filterLines } from '#checker/inspect/patternFilter.ts'
import { workspaceFile } from '#checker/inspect/workspaceFile.ts'
import { errorMessage } from '#checker/safeText.ts'

/** Arguments of the strings tool */
export interface StringsInput {
  path: string
  minLength?: number
  pattern?: string
  regex?: boolean
  ignoreCase?: boolean
}

/** What the strings handler needs */
export interface StringsDeps {
  root: string
  exec: ExecCommand
  limits: Omit<CommandOptions, 'maxBytes' | 'input'>
  maxBytes: number
}

const INPUT_NOTE = `\n[strings output cut at ${FILTER_INPUT_BYTES} bytes before filtering, later matches are missing]`

/**
 * Creates the strings handler: plain strings output, or only the lines matching a pattern, as
 * plain text in Node or as an extended regular expression through grep -E. When the strings
 * output passes the filter input cap, the answer says that matches past it are missing.
 * @param {StringsDeps} deps - Workspace, command runner and limits
 * @returns {(input: StringsInput) => Promise<CallToolResult>} - Tool handler
 */
export const createStringsHandler =
  (deps: StringsDeps) =>
  async ({
    path,
    minLength = 6,
    pattern,
    regex = false,
    ignoreCase = false,
  }: StringsInput): Promise<CallToolResult> => {
    const answerLimits = { timeoutMs: deps.limits.timeoutMs, maxBytes: deps.maxBytes }

    try {
      const file = await workspaceFile(deps.root, path)
      const args = stringsArgs(file.path, minLength)

      if (!pattern) {
        const output = await deps.exec('strings', args, { ...deps.limits, maxBytes: deps.maxBytes })

        return commandResult('strings', output, answerLimits)
      }

      const all = await deps.exec('strings', args, { ...deps.limits, maxBytes: FILTER_INPUT_BYTES })

      if (all.timedOut || (!all.truncated && all.code !== 0)) {
        return commandResult('strings', all, answerLimits)
      }

      const note = all.truncated ? INPUT_NOTE : ''

      const filtered = await filterLines(deps, all, { pattern, regex, ignoreCase })

      return commandResult(
        regex ? filtered.tool : 'strings',
        filtered.output,
        answerLimits,
        regex ? [0, 1] : [0],
        note,
      )
    } catch (error) {
      return toolError(errorMessage(error))
    }
  }
