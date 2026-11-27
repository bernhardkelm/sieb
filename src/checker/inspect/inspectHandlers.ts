import type { CallToolResult } from '@modelcontextprotocol/server'

import type { CommandOutput, ExecCommand } from '#checker/inspect/execCommand.ts'
import {
  jqArgs,
  objdumpArgs,
  readelfArgs,
  unzipArgs,
  type ObjdumpMode,
  type ReadelfMode,
} from '#checker/inspect/inspectArgs.ts'
import { commandResult, toolError } from '#checker/inspect/inspectResult.ts'
import { createStringsHandler, type StringsInput } from '#checker/inspect/stringsHandler.ts'
import { workspaceFile } from '#checker/inspect/workspaceFile.ts'
import { errorMessage } from '#checker/safeText.ts'

const JQ_MAX_FILE_BYTES = 64 * 1024 * 1024

/** What the handlers need */
export interface InspectDeps {
  root: string // resolved workspace directory
  exec: ExecCommand
  path: string // PATH of the commands
  timeoutMs: number
  maxBytes: number // output cap per call
}

/** One handler per inspect tool */
export interface InspectHandlers {
  strings: (input: StringsInput) => Promise<CallToolResult>
  readelf: (input: { path: string; mode: ReadelfMode }) => Promise<CallToolResult>
  objdump: (input: { path: string; mode: ObjdumpMode; symbol?: string }) => Promise<CallToolResult>
  unzip_list: (input: { path: string }) => Promise<CallToolResult>
  jq: (input: { path: string; filter: string }) => Promise<CallToolResult>
}

/**
 * Creates the inspect tool handlers. Every path must resolve to a file inside the workspace,
 * every command runs without a shell, with PATH only, a timeout and an output cap.
 * @param {InspectDeps} deps - Workspace, command runner and limits
 * @returns {InspectHandlers} - Handlers by tool name
 */
export const createInspectHandlers = (deps: InspectDeps): InspectHandlers => {
  const limits = { path: deps.path, cwd: deps.root, timeoutMs: deps.timeoutMs }
  const limitsOfAnswer = { timeoutMs: deps.timeoutMs, maxBytes: deps.maxBytes }

  /**
   * Turns a command outcome into a tool result with the handler limits.
   * @param {string} tool - Command name for messages
   * @param {CommandOutput} output - Command outcome
   * @param {number[]} okCodes - Exit codes that are no failure
   * @returns {CallToolResult} - Text result or error
   */
  const answer = (tool: string, output: CommandOutput, okCodes?: number[]): CallToolResult =>
    commandResult(tool, output, limitsOfAnswer, okCodes)

  /**
   * Runs a command on a workspace file, turning rejected arguments into tool errors.
   * @param {string} tool - Command name
   * @param {string} path - Path argument
   * @param {(file: string) => string[]} args - Builds the arguments for the resolved file
   * @param {number} maxFileBytes - Largest accepted input file
   * @returns {Promise<CallToolResult>} - Tool result
   */
  const run = async (
    tool: string,
    path: string,
    args: (file: string) => string[],
    maxFileBytes = Number.POSITIVE_INFINITY,
  ): Promise<CallToolResult> => {
    try {
      const file = await workspaceFile(deps.root, path)

      if (file.size > maxFileBytes) {
        return toolError(`${tool} reads files up to ${maxFileBytes} bytes`)
      }

      const output = await deps.exec(tool, args(file.path), { ...limits, maxBytes: deps.maxBytes })

      return answer(tool, output)
    } catch (error) {
      return toolError(errorMessage(error))
    }
  }

  return {
    strings: createStringsHandler({
      root: deps.root,
      exec: deps.exec,
      limits,
      maxBytes: deps.maxBytes,
    }),
    readelf: ({ path, mode }) => run('readelf', path, (file) => readelfArgs(file, mode)),
    objdump: ({ path, mode, symbol }) =>
      run('objdump', path, (file) => objdumpArgs(file, mode, symbol)),
    unzip_list: ({ path }) => run('unzip', path, unzipArgs),
    jq: ({ path, filter }) => run('jq', path, (file) => jqArgs(file, filter), JQ_MAX_FILE_BYTES),
  }
}
