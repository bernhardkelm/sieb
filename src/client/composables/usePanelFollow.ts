import { watch, type Ref } from 'vue'

import { useFindingPanel } from '@/composables/useFindingPanel'

export interface PanelFollowOptions<K> {
  keys: Readonly<Ref<readonly K[]>>
  /** Finding shown by a row, null for group rows */
  findingIdOf: (key: K) => number | null
  keyOfFinding: (id: number) => K
}

export interface PanelFollow<K> {
  /** Lets the panel follow a cursor moved by key, given the cursor before the move */
  followKeyMove: (before: K | null) => void
}

/**
 * Couples the side panel and the cursor of a list. While the panel shows the cursor row, or the
 * cursor moved by key, the panel follows the cursor, so a decided row leaving the list hands
 * panel and cursor to the next row; a finding opened by link puts the cursor on its row once
 * listed, and an empty cursor starts on the first row.
 * @param {Ref<K | null>} currentKey - Cursor row
 * @param {PanelFollowOptions<K>} options - Rows and their findings
 * @returns {PanelFollow<K>} - Hook for key moves
 */
export const usePanelFollow = <K>(
  currentKey: Ref<K | null>,
  options: PanelFollowOptions<K>,
): PanelFollow<K> => {
  const { findingId, openFinding } = useFindingPanel()
  let followOnChange = false

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
   * Lets the panel follow through the cursor watcher, or at once when the cursor stayed at an
   * end of the list.
   * @param {K | null} before - Cursor before the move
   * @returns {void}
   */
  const followKeyMove = (before: K | null): void => {
    if (currentKey.value === before) {
      followCursor()
    } else {
      followOnChange = true
    }
  }

  watch(currentKey, (key, previous) => {
    const shown = previous === null ? null : options.findingIdOf(previous)
    const follow = followOnChange || (shown !== null && findingId.value === String(shown))

    followOnChange = false

    if (follow && key !== null) {
      followCursor()
    }
  })

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

  return { followKeyMove }
}
