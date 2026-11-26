import { watch, type ComputedRef, type Ref } from 'vue'

import type { CursorList } from '@/composables/useCursorList'
import { useQueryParam } from '@/composables/useQueryParam'
import { findingIdOfRowKey, groupRowKey } from '@/keyboard/rowKey'

export interface ExpandedGroup {
  value: ComputedRef<string | null>
  toggle: (group: string) => void
  collapse: (focusKey: (key: string) => Promise<void>) => void
  placeCursor: (keys: Readonly<Ref<readonly string[]>>, cursor: CursorList) => void
}

/**
 * Keeps the single expanded group of a list view in a query param, so the expansion is linkable.
 * @param {string} queryKey - Query param holding the expanded group
 * @returns {ExpandedGroup} - Expanded group and its actions
 */
export const useExpandedGroup = (queryKey: string): ExpandedGroup => {
  const { value, set } = useQueryParam(queryKey)

  /**
   * Expands a group, or collapses it when it is expanded already.
   * @param {string} group - Group identifier
   * @returns {void}
   */
  const toggle = (group: string): void => {
    void set(value.value === group ? null : group)
  }

  /**
   * Collapses the expanded group and puts the cursor on its row.
   * @param {(key: string) => Promise<void>} focusKey - Moves the cursor to a row and focuses it
   * @returns {void}
   */
  const collapse = (focusKey: (key: string) => Promise<void>): void => {
    if (value.value !== null) {
      void focusKey(groupRowKey(value.value))
      void set(null)
    }
  }

  /**
   * Puts the cursor on the expanded group once its row is listed, for views opened by link,
   * unless the cursor already sits on a finding row.
   * @param {Readonly<Ref<readonly string[]>>} keys - Row keys in display order
   * @param {CursorList} cursor - Cursor of the list
   * @returns {void}
   */
  const placeCursor = (keys: Readonly<Ref<readonly string[]>>, cursor: CursorList): void => {
    let placed = false

    watch(
      () => value.value !== null && keys.value.includes(groupRowKey(value.value)),
      (listed) => {
        if (placed || !listed || value.value === null) {
          return
        }

        placed = true

        if (findingIdOfRowKey(cursor.currentKey.value) === null) {
          void cursor.focusKey(groupRowKey(value.value))
        }
      },
      { immediate: true },
    )
  }

  return { value, toggle, collapse, placeCursor }
}
