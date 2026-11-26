import type { ShortcutScope } from '@/keyboard/inboxKeymap'

export type ListAction = 'next' | 'previous' | 'activate' | 'close' | 'search'

const KEYS: Record<string, ListAction> = {
  j: 'next',
  ArrowDown: 'next',
  k: 'previous',
  ArrowUp: 'previous',
  Enter: 'activate',
  o: 'activate',
  Escape: 'close',
  '/': 'search',
}

const PAGE_ONLY = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'o', 'Escape'])

/**
 * Maps a key press in a grouped list view to its action. Inside popovers and dialogs nothing
 * applies; inside the side panel only j, k and / apply, so arrows keep scrolling the panel.
 * @param {Pick<KeyboardEvent, 'key'>} event - Key press
 * @param {ShortcutScope} scope - Where the key was pressed
 * @returns {ListAction | null} - Action, null for keys without one
 */
export const listActionFor = (
  event: Pick<KeyboardEvent, 'key'>,
  scope: ShortcutScope,
): ListAction | null => {
  const action = KEYS[event.key]

  if (action === undefined || scope === 'overlay') {
    return null
  }

  return scope === 'panel' && PAGE_ONLY.has(event.key) ? null : action
}
