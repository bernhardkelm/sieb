import { nextTick, onBeforeUnmount, watch, type Ref, type ShallowRef } from 'vue'

import type { ListViewport } from '@/composables/useListViewport'
import { focusRow, revealRow } from '@/keyboard/revealRow'

export interface RowFocus {
  /** Scrolls the cursor row into view and focuses it unless focus sits in the panel */
  revealCurrent: () => Promise<void>
}

/**
 * Keeps keyboard focus on the cursor row of a list: reveals it on demand and focuses it again
 * whenever focus fell back to the page body, after the cursor changed or a dialog of the view
 * closed, so focus never stays lost. A virtualized list scrolls a row that is not rendered into
 * view through its viewport first, the row is focused once rendered; without a viewport every
 * row is in the DOM and scrolls itself into view.
 * @param {Ref<K | null>} currentKey - Cursor row
 * @param {(key: K) => HTMLElement | null} rowOf - Rendered element of a row
 * @param {() => boolean} paused - Whether a dialog of the view holds the keys
 * @param {Readonly<ShallowRef<ListViewport<K> | null>>} viewport - Viewport of the virtualized list, null without one
 * @returns {RowFocus} - Reveal action
 */
export const useRowFocus = <K>(
  currentKey: Ref<K | null>,
  rowOf: (key: K) => HTMLElement | null,
  paused: () => boolean,
  viewport: Readonly<ShallowRef<ListViewport<K> | null>>,
): RowFocus => {
  let recoverTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Scrolls the cursor row into view and focuses it unless focus sits in the panel.
   * @returns {Promise<void>} - Resolves after the next render
   */
  const revealCurrent = async (): Promise<void> => {
    await nextTick()

    const key = currentKey.value

    if (key === null) {
      return
    }

    if (viewport.value === null) {
      revealRow(rowOf(key))
      return
    }

    const row = await viewport.value.reveal(key)

    if (currentKey.value === key) {
      focusRow(row)
    }
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

  watch(currentKey, () => {
    void recoverFocus()
  })

  watch(paused, (isPaused) => {
    if (!isPaused) {
      recoverTimer = setTimeout(() => {
        recoverTimer = null
        void recoverFocus()
      })
    }
  })

  onBeforeUnmount(() => {
    if (recoverTimer !== null) {
      clearTimeout(recoverTimer)
    }
  })

  return { revealCurrent }
}
