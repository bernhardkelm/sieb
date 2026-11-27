/** Client a hand-off link opens, each with the prompt prefilled but not sent */
export type HandoffTarget = 'desktop-code' | 'desktop-chat' | 'cli' | 'vscode'

export const HANDOFF_TARGETS: readonly HandoffTarget[] = [
  'desktop-code',
  'desktop-chat',
  'cli',
  'vscode',
]

/** Kind of client a target opens: Claude Code with a working directory, or the chat */
export type HandoffClient = 'code' | 'chat'

export const HANDOFF_CLIENTS: Readonly<Record<HandoffTarget, HandoffClient>> = {
  'desktop-code': 'code',
  'desktop-chat': 'chat',
  cli: 'code',
  vscode: 'code',
}

/** Encoded prompt length a link must stay below, receiving apps cut longer ones silently */
export const PROMPT_LINK_LIMIT = 800

/**
 * Builds a deep link with the prompt as its only query value, or refuses a prompt whose encoded
 * form does not stay below PROMPT_LINK_LIMIT, so a link never carries a cut-off prompt.
 * @param {string} base - Link up to and including the parameter name, such as claude://code/new?q=
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
const promptLink = (base: string, prompt: string): string | null => {
  const encoded = encodeURIComponent(prompt)

  return encoded.length < PROMPT_LINK_LIMIT ? `${base}${encoded}` : null
}

/**
 * Builds the link that opens a new session in the Code tab of the Claude app.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const claudeDesktopCodeLink = (prompt: string): string | null =>
  promptLink('claude://code/new?q=', prompt)

/**
 * Builds the link that opens a new chat in the Claude app, on the desktop or a phone.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const claudeDesktopChatLink = (prompt: string): string | null =>
  promptLink('claude://claude.ai/new?q=', prompt)

/**
 * Builds the link that opens Claude Code in a terminal, in the folder the handler picks.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const claudeCliLink = (prompt: string): string | null =>
  promptLink('claude-cli://open?q=', prompt)

/**
 * Builds the link that opens the Claude Code extension in VS Code.
 * @param {string} prompt - Prompt to prefill
 * @returns {string | null} - Link, null when the prompt is too long
 */
export const vscodeLink = (prompt: string): string | null =>
  promptLink('vscode://anthropic.claude-code/open?prompt=', prompt)

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
