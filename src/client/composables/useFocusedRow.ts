import { onBeforeUnmount, onMounted, shallowRef, type Ref, type ShallowRef } from 'vue'

/**
 * Tracks which row of a virtualized list focus last moved to, so the list keeps that row
 * rendered while it may still hold focus, also after the cursor moved away from it.
 * @param {Readonly<Ref<HTMLElement | null>>} list - List element holding rows with data-index
 * @param {() => readonly T[]} items - Rows in display order
 * @param {(item: T) => K} keyOf - Key of a row
 * @returns {Readonly<ShallowRef<K | null>>} - Key of the focused row, null before any focus
 */
export const useFocusedRow = <T, K>(
  list: Readonly<Ref<HTMLElement | null>>,
  items: () => readonly T[],
  keyOf: (item: T) => K,
): Readonly<ShallowRef<K | null>> => {
  const focusedKey = shallowRef<K | null>(null)

  /**
   * Remembers the row focus moved to.
   * @param {FocusEvent} event - Focus event inside the list
   * @returns {void}
   */
  const onFocusin = (event: FocusEvent): void => {
    const row = event.target instanceof Element ? event.target.closest('[data-index]') : null
    const item = row === null ? undefined : items()[Number(row.getAttribute('data-index'))]

    focusedKey.value = item === undefined ? null : keyOf(item)
  }

  onMounted(() => {
    list.value?.addEventListener('focusin', onFocusin)
  })

  onBeforeUnmount(() => {
    list.value?.removeEventListener('focusin', onFocusin)
  })

  return focusedKey
}
