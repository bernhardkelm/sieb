import type { Ref } from 'vue'

import { useCursorKeys } from '@/composables/useCursorKeys'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { useListSelection, type ListSelection } from '@/composables/useListSelection'
import { provideListViewport } from '@/composables/useListViewport'
import { usePanelFollow } from '@/composables/usePanelFollow'
import { useRowFocus } from '@/composables/useRowFocus'
import type { ShortcutScope } from '@/keyboard/inboxKeymap'
import type { CursorStep } from '@/keyboard/listNavigation'
import { pageStepOf } from '@/keyboard/pageStep'
import { rowClickIntent } from '@/keyboard/rowClick'

export interface ListCursorOptions<K> {
  /** Row keys in display order */
  keys: Readonly<Ref<readonly K[]>>
  /** Finding shown by a row, null for group rows */
  findingIdOf: (key: K) => number | null
  keyOfFinding: (id: number) => K
  /** Rendered element of a row, null when it is not rendered */
  rowOf: (key: K) => HTMLElement | null
  /** Runs the view action of a key press, returns whether it handled the key */
  handleKey: (event: KeyboardEvent, scope: ShortcutScope) => boolean
  /** Checks rows for bulk actions: Shift ranges, Space, select all and the modifier clicks */
  multiselect?: boolean
  /** Suspends the keys, for example while a dialog of the view is open */
  paused?: () => boolean
}

export interface ListCursor<K> {
  selection: ListSelection<K>
  currentKey: Ref<K | null>
  move: (step: CursorStep, extend?: boolean) => void
  /** Checks or unchecks the cursor row, as Space and x do */
  toggleCurrent: () => void
  /** Handles the modifier clicks on a row, returns false for a plain click the view handles */
  click: (key: K, event?: MouseEvent) => boolean
  focusKey: (key: K) => Promise<void>
  refocus: () => Promise<void>
}

/**
 * Drives the keyboard cursor every list view shares: the cursor keys and the range selection of
 * the shared keymap, the side panel following the cursor and focus kept on the cursor row. The
 * remaining keys go to the view handler. Cursor and selection work on the row keys, never on
 * rendered rows, and a virtualized list of the view scrolls the cursor row into view.
 * @param {ListCursorOptions<K>} options - Rows and the view key handler
 * @returns {ListCursor<K>} - Cursor and its actions
 */
export const useListCursor = <K>(options: ListCursorOptions<K>): ListCursor<K> => {
  const { findingId } = useFindingPanel()
  const multiselect = options.multiselect ?? false
  const selection = useListSelection(options.keys)
  const { currentId: currentKey } = selection
  /**
   * Returns whether a dialog of the view holds the keys.
   * @returns {boolean} - True while paused
   */
  const paused = (): boolean => options.paused?.() ?? false
  const viewport = provideListViewport<K>()
  const { revealCurrent } = useRowFocus(currentKey, options.rowOf, paused, viewport)
  const { followKeyMove } = usePanelFollow(currentKey, {
    ...options,
    reveal: () => {
      void revealCurrent()
    },
  })

  /**
   * Returns how many rows PageUp and PageDown move, measured by the virtualized list or from
   * the cursor row.
   * @returns {number} - Rows per page
   */
  const pageStep = (): number =>
    viewport.value?.pageStep() ??
    pageStepOf(currentKey.value === null ? null : options.rowOf(currentKey.value))

  /**
   * Moves the cursor by a step, extending the checked range in lists with multiple selection,
   * lets the panel follow and reveals the row.
   * @param {CursorStep} step - Step
   * @param {boolean} extend - Whether the move extends the checked range
   * @returns {void}
   */
  const move = (step: CursorStep, extend = false): void => {
    const before = currentKey.value

    if (extend && multiselect) {
      selection.extend(step)
    } else {
      selection.move(step)
    }

    followKeyMove(before)
    void revealCurrent()
  }

  /**
   * Handles Shift and Cmd or Ctrl clicks on a row in lists with multiple selection: Shift checks
   * the range from the anchor, the command modifier checks or unchecks the row; both put the
   * cursor on it.
   * @param {K} key - Clicked row
   * @param {MouseEvent | undefined} event - Click
   * @returns {boolean} - Whether the click was handled
   */
  const click = (key: K, event?: MouseEvent): boolean => {
    const intent = rowClickIntent(event, multiselect)

    if (intent === 'open') {
      return false
    }

    if (intent === 'range') {
      document.getSelection()?.removeAllRanges()
      selection.extendTo(key)
    } else {
      currentKey.value = key
      selection.toggleChecked(key)
    }

    void revealCurrent()
    return true
  }

  /**
   * Puts the cursor on a row and focuses it.
   * @param {K} key - Row key
   * @returns {Promise<void>} - Resolves once focused
   */
  const focusKey = async (key: K): Promise<void> => {
    currentKey.value = key
    await revealCurrent()
  }

  /**
   * Checks or unchecks the cursor row, nothing without a cursor.
   * @returns {void}
   */
  const toggleCurrent = (): void => {
    if (currentKey.value !== null) {
      selection.toggleChecked(currentKey.value)
    }
  }

  useCursorKeys({
    multiselect,
    pageStep,
    move,
    toggleCurrent,
    checkAll: selection.checkAll,
    clearChecked: () => {
      const any = selection.checkedIds.value.size > 0

      selection.clearChecked()
      return any
    },
    panelOpen: () => findingId.value !== null,
    handleKey: options.handleKey,
    paused,
  })

  return { selection, currentKey, move, toggleCurrent, click, focusKey, refocus: revealCurrent }
}
