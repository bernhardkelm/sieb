import type { HandoffActions } from '@/composables/HandoffActions'
import type { HintActionId } from '@/keyboard/hintActions'

export type HandoffKind = 'open' | 'prompt' | 'command'

export interface HandoffKey {
  kind: HandoffKind
  /** `KeyboardEvent.key` that runs the action */
  key: string
  /** Value of `aria-keyshortcuts` */
  shortcut: string
  /** Keys a KeyHint shows */
  hintKeys: string[]
  hintId: HintActionId
  label: string
  /** Label with `{n}` where the count of carried findings goes */
  template: string
  run: (actions: HandoffActions) => unknown
  blockedBy: (actions: HandoffActions) => string | null
}

export const HANDOFF_KEYS: Readonly<Record<HandoffKind, HandoffKey>> = {
  open: {
    kind: 'open',
    key: 'H',
    shortcut: 'Shift+H',
    hintKeys: ['⇧', 'H'],
    hintId: 'handoffOpen',
    label: 'Open in Claude',
    template: 'Open {n} in Claude',
    run: (actions) => actions.openPreferred(),
    blockedBy: (actions) => actions.openBlockedBy(),
  },
  prompt: {
    kind: 'prompt',
    key: 'h',
    shortcut: 'h',
    hintKeys: ['h'],
    hintId: 'handoff',
    label: 'Copy for Claude',
    template: 'Copy {n} for Claude',
    run: (actions) => actions.copyPrompt(),
    blockedBy: (actions) => actions.promptBlockedBy(),
  },
  command: {
    kind: 'command',
    key: 'y',
    shortcut: 'y',
    hintKeys: ['y'],
    hintId: 'handoffCommand',
    label: 'Copy claude command',
    template: 'Copy claude command for {n}',
    run: (actions) => actions.copyCommand(),
    blockedBy: (actions) => actions.commandBlockedBy(),
  },
}

/** Hand-off keys in the order the hints list them */
export const HANDOFF_KEYMAP: readonly HandoffKey[] = Object.values(HANDOFF_KEYS)

export const AUTO_CHECK_KEY = 'C'
export const AUTO_CHECK_SHORTCUT = 'Shift+C'
export const AUTO_CHECK_HINT_KEYS = ['⇧', AUTO_CHECK_KEY]

const SHIFT_ONLY = new Set([HANDOFF_KEYS.open.key, AUTO_CHECK_KEY])

/**
 * Returns the Claude action of a key press: a hand-off key or the Auto-check. Shift+H and Shift+C
 * apply only with Shift held, so Caps Lock alone does nothing.
 * @param {Pick<KeyboardEvent, 'key' | 'shiftKey'>} event - Key press
 * @returns {HandoffKey | 'autoCheck' | null} - Action, null for other keys
 */
export const claudeKeyOf = (
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
): HandoffKey | 'autoCheck' | null => {
  if (SHIFT_ONLY.has(event.key) && !event.shiftKey) {
    return null
  }

  if (event.key === AUTO_CHECK_KEY) {
    return 'autoCheck'
  }

  return HANDOFF_KEYMAP.find((candidate) => candidate.key === event.key) ?? null
}
