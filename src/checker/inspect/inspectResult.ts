import type { CallToolResult } from '@modelcontextprotocol/server'

import type { CommandOutput } from '#checker/inspect/execCommand.ts'

/**
 * Answers a tool call with an error the model can act on.
 * @param {string} message - What went wrong
 * @returns {CallToolResult} - Error result
 */
export const toolError = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
})

/**
 * Turns a command outcome into a tool result, cut to the output cap with a note.
 * @param {string} tool - Command name for messages
 * @param {CommandOutput} output - Command outcome
 * @param {{ timeoutMs: number, maxBytes: number }} limits - Timeout and output cap of the call
 * @param {number[]} okCodes - Exit codes that are no failure
 * @param {string} inputNote - Note appended when the input of the command was cut
 * @returns {CallToolResult} - Text result or error
 */
export const commandResult = (
  tool: string,
  output: CommandOutput,
  limits: { timeoutMs: number; maxBytes: number },
  okCodes: number[] = [0],
  inputNote = '',
): CallToolResult => {
  if (output.timedOut) {
    return toolError(`${tool} timed out after ${limits.timeoutMs / 1000} s`)
  }

  // a command stopped at the output cap ends without exit code, its output is still valid
  if (!output.truncated && (output.code === null || !okCodes.includes(output.code))) {
    const reason = output.stderr.trim().split('\n').pop() ?? ''

    return toolError(`${tool} exited with ${output.code ?? 'a signal'}: ${reason.slice(0, 300)}`)
  }

  const cut = output.truncated || output.stdout.length > limits.maxBytes
  const text = output.stdout.subarray(0, limits.maxBytes).toString('utf8')
  const note = cut ? `\n[output truncated at ${limits.maxBytes} bytes]` : ''

  return { content: [{ type: 'text', text: `${text || '(no output)'}${note}${inputNote}` }] }
}
