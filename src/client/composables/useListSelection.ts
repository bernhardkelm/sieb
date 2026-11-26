import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import { withRange } from '@/keyboard/listRange'
import { reconcileCursor, stepCursor, toggleId, type CursorStep } from '@/keyboard/listNavigation'

export interface ListSelection<T> {
  currentId: Ref<T | null>
  checkedIds: Ref<Set<T>>
  checkedInOrder: ComputedRef<T[]>
  /** Moves the cursor without touching the checked rows */
  move: (step: CursorStep) => void
  /** Moves the cursor and checks the range from the anchor to it */
  extend: (step: CursorStep) => void
  /** Puts the cursor on a row and checks the range from the anchor to it */
  extendTo: (id: T) => void
  /** Checks or unchecks a row and makes it the anchor */
  toggleChecked: (id: T) => void
  checkAll: () => void
  clearChecked: () => void
}

/**
 * Tracks the cursor and the checked rows of a list, with range selection from an anchor as in a
 * native list. Moving the cursor plainly keeps the checked rows and starts the next range at the
 * new cursor; extending checks every row from the anchor to the cursor on top of the rows checked
 * before, so turning back shrinks the range. When the cursor row leaves the list the cursor moves
 * to the next remaining row, checked rows that left are unchecked.
 * @param {Readonly<Ref<readonly T[]>>} ids - Row ids in display order
 * @returns {ListSelection<T>} - Cursor, checked rows and their actions
 */
export const useListSelection = <T>(ids: Readonly<Ref<readonly T[]>>): ListSelection<T> => {
  const currentId = ref<T | null>(null) as Ref<T | null>
  const checkedIds = ref(new Set<T>()) as Ref<Set<T>>
  let anchor: T | null = null
  let anchorCursor: T | null = null
  let base = new Set<T>()

  const checkedInOrder = computed(() => ids.value.filter((id) => checkedIds.value.has(id)))

  /**
   * Starts the next range at a row, on top of the rows checked now. The anchor holds while the
   * cursor stays where it is now, so a checkbox clicked away from the cursor anchors as well.
   * @param {T | null} id - Anchor row
   * @returns {void}
   */
  const anchorAt = (id: T | null): void => {
    anchor = id
    anchorCursor = currentId.value
    base = new Set(checkedIds.value)
  }

  /**
   * Moves the cursor by a step.
   * @param {CursorStep} step - Step
   * @returns {void}
   */
  const move = (step: CursorStep): void => {
    currentId.value = stepCursor(ids.value, currentId.value, step)
  }

  /**
   * Puts the cursor on a row and checks the range from the anchor to it. A cursor moved since
   * the last selection action, or an anchor that left the list, starts a new range at the cursor.
   * @param {T} id - Row id
   * @returns {void}
   */
  const extendTo = (id: T): void => {
    if (anchor === null || anchorCursor !== currentId.value || !ids.value.includes(anchor)) {
      anchorAt(currentId.value ?? id)
    }

    currentId.value = id
    anchorCursor = id
    checkedIds.value = withRange(ids.value, base, anchor ?? id, id)
  }

  /**
   * Moves the cursor by a step and checks the range from the anchor to it.
   * @param {CursorStep} step - Step
   * @returns {void}
   */
  const extend = (step: CursorStep): void => {
    const target = stepCursor(ids.value, currentId.value, step)

    if (target !== null) {
      extendTo(target)
    }
  }

  /**
   * Checks or unchecks a row and starts the next range there.
   * @param {T} id - Row id
   * @returns {void}
   */
  const toggleChecked = (id: T): void => {
    checkedIds.value = toggleId(checkedIds.value, id)
    anchorAt(id)
  }

  /**
   * Checks every listed row.
   * @returns {void}
   */
  const checkAll = (): void => {
    checkedIds.value = new Set(ids.value)
    anchorAt(currentId.value)
  }

  /**
   * Unchecks every row.
   * @returns {void}
   */
  const clearChecked = (): void => {
    checkedIds.value = new Set()
    anchorAt(currentId.value)
  }

  watch(ids, (next, previous) => {
    currentId.value = reconcileCursor(previous ?? [], next, currentId.value)

    const listed = new Set(next)

    if ([...checkedIds.value].some((id) => !listed.has(id))) {
      checkedIds.value = new Set([...checkedIds.value].filter((id) => listed.has(id)))
    }
  })

  return {
    currentId,
    checkedIds,
    checkedInOrder,
    move,
    extend,
    extendTo,
    toggleChecked,
    checkAll,
    clearChecked,
  }
}
