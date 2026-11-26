export type InboxAction =
  | 'next'
  | 'previous'
  | 'open'
  | 'close'
  | 'accept'
  | 'notAffected'
  | 'fixPlanned'
  | 'toggleCheck'
  | 'bulk'
  | 'search'

/** Where a key was pressed: the page, the side panel or a popover or dialog */
export type ShortcutScope = 'page' | 'panel' | 'overlay'

const KEYS: Record<string, InboxAction> = {
  j: 'next',
  ArrowDown: 'next',
  k: 'previous',
  ArrowUp: 'previous',
  Enter: 'open',
  o: 'open',
  Escape: 'close',
  a: 'accept',
  n: 'notAffected',
  f: 'fixPlanned',
  x: 'toggleCheck',
  A: 'bulk',
  '/': 'search',
}

const PAGE_ONLY = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'o', 'Escape', 'x', 'a', 'n', 'f'])

/**
 * Maps a key press in the inbox to its action. Inside popovers and dialogs nothing applies;
 * inside the side panel only j, k, Shift+A and / apply, the panel handles the rest itself and
 * arrows keep scrolling it.
 * @param {Pick<KeyboardEvent, 'key' | 'shiftKey'>} event - Key press
 * @param {ShortcutScope} scope - Where the key was pressed
 * @returns {InboxAction | null} - Action, null for keys without one
 */
export const inboxActionFor = (
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
  scope: ShortcutScope,
): InboxAction | null => {
  const action = KEYS[event.key]

  if (action === undefined || scope === 'overlay') {
    return null
  }

  if (event.key === 'A' && !event.shiftKey) {
    return null
  }

  if (scope === 'panel' && PAGE_ONLY.has(event.key)) {
    return null
  }

  return action
}
