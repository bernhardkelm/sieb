import type { ShortcutScope } from '@/keyboard/inboxKeymap'

export type ListAction = 'activate' | 'close' | 'expand' | 'collapse' | 'search'

const KEYS: Record<string, ListAction> = {
  Enter: 'activate',
  o: 'activate',
  Escape: 'close',
  ArrowRight: 'expand',
  ArrowLeft: 'collapse',
  '/': 'search',
}

const PAGE_ONLY = new Set(['Enter', 'o', 'Escape', 'ArrowRight', 'ArrowLeft'])

/**
 * Maps a key press in a grouped list view to its action, on top of the cursor keys every list
 * shares. Inside popovers and dialogs nothing applies; inside the side panel only / applies, so
 * arrows keep scrolling the panel.
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
