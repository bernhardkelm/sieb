import { HANDOFF_TARGETS, type HandoffTarget } from '#core/handoffLinks.ts'

/** What the primary hand-off action does: open a client or copy the prompt */
export type HandoffPreference = HandoffTarget | 'copy'

export interface HandoffOption {
  /** Menu entry */
  label: string
  /** Label of the primary button while the option is the default action */
  action: string
  /** What the option needs on this machine */
  help: string
}

export const HANDOFF_OPTIONS: Record<HandoffPreference, HandoffOption> = {
  'desktop-code': {
    label: 'Claude Code (app)',
    action: 'Open in Claude Code',
    help: 'Needs the Claude app',
  },
  'desktop-chat': {
    label: 'Claude chat (app)',
    action: 'Open in Claude chat',
    help: 'Needs the sieb connector in Claude',
  },
  cli: {
    label: 'Claude Code in terminal',
    action: 'Open in terminal',
    help: 'Needs Claude Code run once in a terminal',
  },
  vscode: {
    label: 'VS Code',
    action: 'Open in VS Code',
    help: 'Needs the Claude Code VS Code extension',
  },
  copy: {
    label: 'Copy prompt',
    action: 'Copy for Claude',
    help: 'Paste it into any Claude client',
  },
}

export const HANDOFF_PREFERENCES: readonly HandoffPreference[] = [...HANDOFF_TARGETS, 'copy']

/**
 * Returns whether a stored value is a known hand-off preference.
 * @param {unknown} value - Stored value
 * @returns {boolean} - True for a target or copy
 */
export const isHandoffPreference = (value: unknown): value is HandoffPreference =>
  HANDOFF_PREFERENCES.includes(value as HandoffPreference)
