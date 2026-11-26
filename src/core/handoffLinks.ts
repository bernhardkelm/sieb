/** Client a hand-off link opens, each with the prompt prefilled but not sent */
export type HandoffTarget = 'desktop-code' | 'desktop-chat' | 'cli' | 'vscode'

export const HANDOFF_TARGETS: readonly HandoffTarget[] = [
  'desktop-code',
  'desktop-chat',
  'cli',
  'vscode',
]

/** Longest encoded prompt the Claude desktop app takes without truncating it */
export const DESKTOP_PROMPT_LIMIT = 14_000

/** Longest encoded prompt the Claude Code CLI handler takes, also applied to VS Code */
export const CLI_PROMPT_LIMIT = 5_000

/**
 * Builds a deep link with the prompt as its only query value, or refuses a prompt whose encoded
 * form does not stay below the limit, so a link never carries a cut-off prompt.
 * @param {string} base - Link up to and including the parameter name, such as claude://code/new?q=
 * @param {string} prompt - Prompt to prefill
 * @param {number} limit - Encoded length the prompt must stay below
 * @returns {string | null} - Link, null when the prompt is too long
 */
const promptLink = (base: string, prompt: string, limit: number): string | null => {
  const encoded = encodeURIComponent(prompt)

  return encoded.length < limit ? `${base}${encoded}` : null
}

/**
 * Builds the link that opens a new session in the Code tab of the Claude desktop app.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const claudeDesktopCodeLink = (prompt: string): string | null =>
  promptLink('claude://code/new?q=', prompt, DESKTOP_PROMPT_LIMIT)

/**
 * Builds the link that opens a new chat in the Claude desktop app.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const claudeDesktopChatLink = (prompt: string): string | null =>
  promptLink('claude://claude.ai/new?q=', prompt, DESKTOP_PROMPT_LIMIT)

/**
 * Builds the link that opens Claude Code in a terminal, in the folder the handler picks.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const claudeCliLink = (prompt: string): string | null =>
  promptLink('claude-cli://open?q=', prompt, CLI_PROMPT_LIMIT)

/**
 * Builds the link that opens the Claude Code extension in VS Code.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const vscodeLink = (prompt: string): string | null =>
  promptLink('vscode://anthropic.claude-code/open?prompt=', prompt, CLI_PROMPT_LIMIT)

const BUILDERS: Record<HandoffTarget, (prompt: string) => string | null> = {
  'desktop-code': claudeDesktopCodeLink,
  'desktop-chat': claudeDesktopChatLink,
  cli: claudeCliLink,
  vscode: vscodeLink,
}

/**
 * Builds the hand-off link of a target.
 * @param {HandoffTarget} target - Client to open
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long for the target
 */
export const handoffLink = (target: HandoffTarget, prompt: string): string | null =>
  BUILDERS[target](prompt)
