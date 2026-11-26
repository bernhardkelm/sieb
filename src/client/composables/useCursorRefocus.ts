import { onBeforeUnmount, onMounted, type Ref } from 'vue'

const ROW_SELECTOR = '[role="option"], [role="row"]'

/**
 * Returns focus to the cursor row after a pointer press on another row, such as on its
 * checkbox, focused that row while the cursor stayed. It acts only when a list row held focus as
 * the press began, so focus in a text entry or the panel stays where the press put it, and it
 * never scrolls.
 * @param {Ref<K | null>} currentKey - Cursor row key
 * @param {(key: K) => HTMLElement | null} rowOf - Rendered row element of a key
 * @returns {() => void} - Refocuses the cursor row, call it after handling the press
 */
export const useCursorRefocus = <K>(
  currentKey: Ref<K | null>,
  rowOf: (key: K) => HTMLElement | null,
): (() => void) => {
  let focusedAtPress: Element | null = null

  /**
   * Records which element held focus before the press moves it.
   * @returns {void}
   */
  const onPointerdown = (): void => {
    focusedAtPress = document.activeElement
  }

  onMounted(() => {
    window.addEventListener('pointerdown', onPointerdown, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onPointerdown, true)
  })

  /**
   * Focuses the cursor row when a list row held focus as the latest press began.
   * @returns {void}
   */
  const refocus = (): void => {
    const pressedFromRow = focusedAtPress !== null && focusedAtPress.closest(ROW_SELECTOR) !== null
    const row = currentKey.value === null ? null : rowOf(currentKey.value)

    focusedAtPress = null

    if (pressedFromRow && row !== null && document.activeElement !== row) {
      row.focus({ preventScroll: true })
    }
  }

  return refocus
}
