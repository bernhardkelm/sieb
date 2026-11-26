export type TriageAction =
  | 'open'
  | 'close'
  | 'accept'
  | 'notAffected'
  | 'fixPlanned'
  | 'bulk'
  | 'search'

/** Where a key was pressed: the page, the side panel or a popover or dialog */
export type ShortcutScope = 'page' | 'panel' | 'overlay'

const KEYS: Record<string, TriageAction> = {
  Enter: 'open',
  o: 'open',
  Escape: 'close',
  a: 'accept',
  n: 'notAffected',
  f: 'fixPlanned',
  A: 'bulk',
  '/': 'search',
}

const PAGE_ONLY = new Set(['Enter', 'o', 'Escape', 'a', 'n', 'f'])

/**
 * Maps a key press in the triage list to its action, on top of the cursor keys every list shares.
 * Inside popovers and dialogs nothing applies; inside the side panel only Shift+A and / apply,
 * the panel handles the rest itself.
 * @param {Pick<KeyboardEvent, 'key' | 'shiftKey'>} event - Key press
 * @param {ShortcutScope} scope - Where the key was pressed
 * @returns {TriageAction | null} - Action, null for keys without one
 */
export const triageActionFor = (
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
  scope: ShortcutScope,
): TriageAction | null => {
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
