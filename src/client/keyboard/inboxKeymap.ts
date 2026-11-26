import type { ShortcutScope } from '@/keyboard/triageKeymap'

export type InboxAction = 'open' | 'close' | 'markSeen'

const KEYS: Record<string, InboxAction> = {
  Enter: 'open',
  o: 'open',
  Escape: 'close',
  s: 'markSeen',
}

/**
 * Maps a key press in the Inbox to its action, on top of the cursor keys every list shares:
 * Enter or o opens the item, Escape closes its panel, s marks the checked or cursor items as
 * seen. Only the page scope applies, the panels and dialogs handle their own keys.
 * @param {Pick<KeyboardEvent, 'key'>} event - Key press
 * @param {ShortcutScope} scope - Where the key was pressed
 * @returns {InboxAction | null} - Action, null for keys without one
 */
export const inboxActionFor = (
  event: Pick<KeyboardEvent, 'key'>,
  scope: ShortcutScope,
): InboxAction | null => (scope === 'page' ? (KEYS[event.key] ?? null) : null)
