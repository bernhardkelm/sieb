import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/server'

/** Annotations of every query tool: reads sieb's own database only */
export const READ_ONLY_TOOL: ToolAnnotations = { readOnlyHint: true, openWorldHint: false }

/**
 * Answers a tool call with structured content and the same data as a compact JSON text block.
 * @param {T} output - Structured result, matching the tool's output schema
 * @returns {CallToolResult & { structuredContent: T }} - Tool result
 */
export const toolResult = <T extends Record<string, unknown>>(
  output: T,
): CallToolResult & { structuredContent: T } => ({
  content: [{ type: 'text', text: JSON.stringify(output) }],
  structuredContent: output,
})

/**
 * Answers a tool call with an error the model can act on, for example an unknown id.
 * @param {string} message - What went wrong and how to retry
 * @returns {CallToolResult} - Error result
 */
export const toolError = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
})
