import { useWindowKeydown } from '@/composables/useWindowKeydown'
import {
  cursorActionFor,
  isRepeatableKey,
  isSelectAllEvent,
  type CursorAction,
  type CursorStepName,
} from '@/keyboard/cursorKeymap'
import { isDraftKey } from '@/keyboard/draftKeys'
import type { ShortcutScope } from '@/keyboard/triageKeymap'
import type { CursorStep } from '@/keyboard/listNavigation'
import {
  isControlTarget,
  isListTarget,
  isShortcutEvent,
  shortcutScope,
} from '@/keyboard/keyboardTarget'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

export interface CursorKeysOptions {
  /** Whether the list checks rows for bulk actions */
  multiselect: boolean
  /** Rows a page step moves */
  pageStep: () => number
  move: (step: CursorStep, extend: boolean) => void
  toggleCurrent: () => void
  checkAll: () => void
  /** Unchecks every row, returns whether any row was checked */
  clearChecked: () => boolean
  panelOpen: () => boolean
  /** Runs the view action of a key press, returns whether it handled the key */
  handleKey: (event: KeyboardEvent, scope: ShortcutScope) => boolean
  /** Suspends the keys, for example while a dialog of the view is open */
  paused?: () => boolean
}

/**
 * Listens to the window for the keys of a list: the shared cursor keys first, then the view
 * keys. Keys pass only outside text entries and overlays and without browser modifiers, apart
 * from the select-all chord inside the list; Enter and Space stay with a focused button, link or
 * tab, and the cursor keys and Escape wait while the decision form of the panel holds an unsaved
 * draft. Escape closes the panel before it clears the checked rows, and those before the view
 * handles it.
 * @param {CursorKeysOptions} options - Cursor actions and the view key handler
 * @returns {void}
 */
export const useCursorKeys = (options: CursorKeysOptions): void => {
  const detail = useFindingDetailStore()

  /**
   * Converts a named step into rows or a jump.
   * @param {CursorStepName} name - Step name
   * @returns {CursorStep} - Step
   */
  const stepOf = (name: CursorStepName): CursorStep => {
    switch (name) {
      case 'next':
        return 1
      case 'previous':
        return -1
      case 'pageNext':
        return options.pageStep()
      case 'pagePrevious':
        return -options.pageStep()
    }

    return name
  }

  /**
   * Runs a shared cursor action.
   * @param {CursorAction} action - Action
   * @returns {boolean} - Whether the action applied
   */
  const run = (action: CursorAction): boolean => {
    switch (action.kind) {
      case 'move':
        options.move(stepOf(action.step), action.extend)
        return true
      case 'toggle':
        options.toggleCurrent()
        return true
      case 'clear':
        return !options.panelOpen() && options.clearChecked()
    }

    return false
  }

  /**
   * Handles the select-all chord, which carries a modifier the other keys must not have.
   * @param {KeyboardEvent} event - Keydown event
   * @param {ShortcutScope} scope - Where the key was pressed
   * @returns {void}
   */
  const onSelectAll = (event: KeyboardEvent, scope: ShortcutScope): void => {
    if (options.multiselect && scope === 'page' && isListTarget(event.target)) {
      event.preventDefault()
      options.checkAll()
    }
  }

  /**
   * Passes a window keydown to the cursor or the view unless a guard keeps it.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    const scope = shortcutScope(event.target)

    if (scope === 'overlay' || options.paused?.()) {
      return
    }

    if (isSelectAllEvent(event)) {
      onSelectAll(event, scope)
      return
    }

    if (!isShortcutEvent(event, isRepeatableKey(event.key))) {
      return
    }

    if ((event.key === 'Enter' || event.key === ' ') && isControlTarget(event.target)) {
      return
    }

    if (detail.draftDirty && isDraftKey(event.key)) {
      return
    }

    const action = cursorActionFor(event, scope, options.multiselect)

    if ((action !== null && run(action)) || options.handleKey(event, scope)) {
      event.preventDefault()
    }
  }

  useWindowKeydown(onKeydown)
}
