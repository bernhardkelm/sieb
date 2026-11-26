import type { ShortcutScope } from '@/keyboard/triageKeymap'
import { isEditableTarget } from '@/keyboard/keyboardTarget'
import { hasCommandModifier } from '@/keyboard/modifierKey'

export type CursorStepName = 'next' | 'previous' | 'pageNext' | 'pagePrevious' | 'first' | 'last'

export type CursorAction =
  | { kind: 'move'; step: CursorStepName; extend: boolean }
  | { kind: 'toggle' }
  | { kind: 'clear' }

const STEPS: Record<string, CursorStepName> = {
  j: 'next',
  J: 'next',
  ArrowDown: 'next',
  k: 'previous',
  K: 'previous',
  ArrowUp: 'previous',
  PageDown: 'pageNext',
  PageUp: 'pagePrevious',
  Home: 'first',
  End: 'last',
}

const REPEATABLE = new Set(['j', 'J', 'k', 'K', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'])

const PANEL_KEYS = new Set(['j', 'J', 'k', 'K'])

const TOGGLE_KEYS = new Set([' ', 'x'])

/**
 * Maps a key press to the cursor action every list shares: j, k and the vertical arrows move,
 * Home and End jump to the ends, PageUp and PageDown move a page; with Shift and in lists with
 * multiple selection they extend the checked range from the anchor. Such lists also toggle the
 * cursor row with Space or x and clear the checked rows with Escape. Inside the side panel only
 * j and k apply, so the other keys keep scrolling it; inside popovers and dialogs nothing does.
 * @param {Pick<KeyboardEvent, 'key' | 'shiftKey'>} event - Key press
 * @param {ShortcutScope} scope - Where the key was pressed
 * @param {boolean} multiselect - Whether the list checks rows for bulk actions
 * @returns {CursorAction | null} - Action, null for keys the view handles
 */
export const cursorActionFor = (
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
  scope: ShortcutScope,
  multiselect: boolean,
): CursorAction | null => {
  if (scope === 'overlay' || (scope === 'panel' && !PANEL_KEYS.has(event.key))) {
    return null
  }

  const step = STEPS[event.key]

  if (step !== undefined) {
    return { kind: 'move', step, extend: multiselect && event.shiftKey }
  }

  if (!multiselect) {
    return null
  }

  if (TOGGLE_KEYS.has(event.key)) {
    return { kind: 'toggle' }
  }

  return event.key === 'Escape' ? { kind: 'clear' } : null
}

/**
 * Returns whether holding a key down keeps repeating its action, as it does for cursor movement.
 * @param {string} key - KeyboardEvent key
 * @returns {boolean} - True for the keys that move the cursor by rows or pages
 */
export const isRepeatableKey = (key: string): boolean => REPEATABLE.has(key)

/**
 * Returns whether a keydown is the select-all chord, Cmd+A on Apple platforms and Ctrl+A
 * elsewhere, outside text entries where it has to select the typed text.
 * @param {KeyboardEvent} event - Keydown event
 * @param {boolean | undefined} apple - Whether the platform is an Apple one, detected when omitted
 * @returns {boolean} - True for the chord
 */
export const isSelectAllEvent = (event: KeyboardEvent, apple?: boolean): boolean =>
  !event.defaultPrevented &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === 'a' &&
  hasCommandModifier(event, apple) &&
  !isEditableTarget(event.target)
