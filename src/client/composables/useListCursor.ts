import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

import { useFindingPanel } from '@/composables/useFindingPanel'
import { useListSelection, type ListSelection } from '@/composables/useListSelection'
import { useWindowKeydown } from '@/composables/useWindowKeydown'
import { isDraftKey } from '@/keyboard/draftKeys'
import type { ShortcutScope } from '@/keyboard/inboxKeymap'
import { isControlTarget, isShortcutEvent, shortcutScope } from '@/keyboard/keyboardTarget'
import { revealRow } from '@/keyboard/revealRow'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

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
  /** Suspends the keys, for example while a dialog of the view is open */
  paused?: () => boolean
}

export interface ListCursor<K> {
  selection: ListSelection<K>
  currentKey: Ref<K | null>
  move: (delta: number) => void
  focusKey: (key: K) => Promise<void>
  refocus: () => Promise<void>
}

/**
 * Drives the keyboard cursor every list view shares. It moves with j and k and reveals the row;
 * while the panel shows the cursor row, or the cursor moved by key, the panel follows it, so a
 * decided row leaving the list hands panel and cursor to the next row; a finding opened by link
 * puts the cursor on its row once listed. Keys pass to the view only outside text entries and
 * overlays, Enter stays with a focused button, link or tab, and j, k and Escape wait while the
 * decision form of the panel holds an unsaved draft.
 * @param {ListCursorOptions<K>} options - Rows and the view key handler
 * @returns {ListCursor<K>} - Cursor and its actions
 */
export const useListCursor = <K>(options: ListCursorOptions<K>): ListCursor<K> => {
  const { findingId, openFinding } = useFindingPanel()
  const detail = useFindingDetailStore()
  const selection = useListSelection(options.keys)
  const { currentId: currentKey } = selection
  let followOnChange = false
  let recoverTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Scrolls the cursor row into view and focuses it unless focus sits in the panel.
   * @returns {Promise<void>} - Resolves after the next render
   */
  const revealCurrent = async (): Promise<void> => {
    await nextTick()

    if (currentKey.value !== null) {
      revealRow(options.rowOf(currentKey.value))
    }
  }

  /**
   * Shows the cursor row in the panel while the panel is open on another finding.
   * @returns {void}
   */
  const followCursor = (): void => {
    const id = currentKey.value === null ? null : options.findingIdOf(currentKey.value)

    if (id !== null && findingId.value !== null && findingId.value !== String(id)) {
      void openFinding(String(id))
    }
  }

  /**
   * Moves the cursor by a step; the panel follows through the cursor watcher, or at once when
   * the cursor stayed at an end of the list.
   * @param {number} delta - Step, negative moves up
   * @returns {void}
   */
  const move = (delta: number): void => {
    const before = currentKey.value

    selection.move(delta)

    if (currentKey.value === before) {
      followCursor()
    } else {
      followOnChange = true
    }

    void revealCurrent()
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
   * Focuses the cursor row, for controls that disappear once used.
   * @returns {Promise<void>} - Resolves once focused
   */
  const refocus = async (): Promise<void> => {
    await revealCurrent()
  }

  /**
   * Focuses the cursor row again when focus fell back to the page body, for example after a
   * dialog closed or the focused row left the list.
   * @returns {Promise<void>} - Resolves once focused
   */
  const recoverFocus = async (): Promise<void> => {
    await nextTick()

    if (document.activeElement === null || document.activeElement === document.body) {
      await revealCurrent()
    }
  }

  /**
   * Passes a window keydown to the view unless a guard keeps it.
   * @param {KeyboardEvent} event - Keydown event
   * @returns {void}
   */
  const onKeydown = (event: KeyboardEvent): void => {
    const scope = shortcutScope(event.target)

    if (!isShortcutEvent(event) || scope === 'overlay' || options.paused?.()) {
      return
    }

    if (event.key === 'Enter' && isControlTarget(event.target)) {
      return
    }

    if (detail.draftDirty && isDraftKey(event.key)) {
      return
    }

    if (options.handleKey(event, scope)) {
      event.preventDefault()
    }
  }

  useWindowKeydown(onKeydown)

  watch(currentKey, (key, previous) => {
    const shown = previous === null ? null : options.findingIdOf(previous)
    const follow = followOnChange || (shown !== null && findingId.value === String(shown))

    followOnChange = false

    if (follow && key !== null) {
      followCursor()
    }

    void recoverFocus()
  })

  watch(
    () => options.paused?.() ?? false,
    (paused) => {
      if (!paused) {
        recoverTimer = setTimeout(() => {
          recoverTimer = null
          void recoverFocus()
        })
      }
    },
  )

  watch(
    [findingId, options.keys],
    ([id, keys]) => {
      const key = id === null ? null : options.keyOfFinding(Number(id))

      if (key !== null && keys.includes(key)) {
        currentKey.value = key
      } else if (currentKey.value === null && keys.length > 0) {
        currentKey.value = keys[0]!
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (recoverTimer !== null) {
      clearTimeout(recoverTimer)
    }
  })

  return { selection, currentKey, move, focusKey, refocus }
}
