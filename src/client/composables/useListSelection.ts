import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import { moveCursor, reconcileCursor, toggleId } from '@/keyboard/listNavigation'

export interface ListSelection<T> {
  currentId: Ref<T | null>
  checkedIds: Ref<Set<T>>
  checkedInOrder: ComputedRef<T[]>
  move: (delta: number) => void
  toggleChecked: (id: T) => void
  clearChecked: () => void
}

/**
 * Tracks the cursor and the checked rows of a list. When the cursor row leaves the list the
 * cursor moves to the next remaining row, checked rows that left are unchecked.
 * @param {Readonly<Ref<readonly T[]>>} ids - Row ids in display order
 * @returns {ListSelection<T>} - Cursor, checked rows and their actions
 */
export const useListSelection = <T>(ids: Readonly<Ref<readonly T[]>>): ListSelection<T> => {
  const currentId = ref<T | null>(null) as Ref<T | null>
  const checkedIds = ref(new Set<T>()) as Ref<Set<T>>

  const checkedInOrder = computed(() => ids.value.filter((id) => checkedIds.value.has(id)))

  /**
   * Moves the cursor by a step.
   * @param {number} delta - Step, negative moves up
   * @returns {void}
   */
  const move = (delta: number): void => {
    currentId.value = moveCursor(ids.value, currentId.value, delta)
  }

  /**
   * Checks or unchecks a row.
   * @param {T} id - Row id
   * @returns {void}
   */
  const toggleChecked = (id: T): void => {
    checkedIds.value = toggleId(checkedIds.value, id)
  }

  /**
   * Unchecks every row.
   * @returns {void}
   */
  const clearChecked = (): void => {
    checkedIds.value = new Set()
  }

  watch(ids, (next, previous) => {
    currentId.value = reconcileCursor(previous ?? [], next, currentId.value)

    const listed = new Set(next)

    if ([...checkedIds.value].some((id) => !listed.has(id))) {
      checkedIds.value = new Set([...checkedIds.value].filter((id) => listed.has(id)))
    }
  })

  return { currentId, checkedIds, checkedInOrder, move, toggleChecked, clearChecked }
}
