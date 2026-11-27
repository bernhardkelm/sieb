import { watch, type Ref } from 'vue'

import { isClearingTarget } from '@/components/list/listBackground'

/** Pointer travel in px from which a press counts as a drag */
const DRAG_DISTANCE = 4

/**
 * Returns whether text is selected on the page, as after a selection drag.
 * @returns {boolean} - True while a text selection exists
 */
const hasTextSelection = (): boolean => (window.getSelection()?.toString() ?? '') !== ''

/**
 * Clears the checked rows on a plain primary click on empty list space, see isClearingTarget.
 * Cursor row and panel stay. A click with a modifier, one that started on another element or
 * moved the pointer, and one that leaves selected text behind do nothing.
 * @param {Readonly<Ref<HTMLElement | null>>} container - List area, the view root
 * @param {() => void} clear - Unchecks every row
 * @returns {void}
 */
export const useClearSelectionOnBackgroundClick = (
  container: Readonly<Ref<HTMLElement | null>>,
  clear: () => void,
): void => {
  let press: { target: EventTarget | null; x: number; y: number } | null = null

  /**
   * Remembers where a primary press started.
   * @param {PointerEvent} event - Pointer press inside the list area
   * @returns {void}
   */
  const onPointerdown = (event: PointerEvent): void => {
    press = event.button === 0 ? { target: event.target, x: event.clientX, y: event.clientY } : null
  }

  /**
   * Clears the checked rows for a plain click on empty list space.
   * @param {MouseEvent} event - Click inside the list area
   * @returns {void}
   */
  const onClick = (event: MouseEvent): void => {
    const start = press

    press = null

    if (
      start === null ||
      event.button !== 0 ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return
    }

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_DISTANCE

    if (start.target !== event.target || moved || hasTextSelection()) {
      return
    }

    if (isClearingTarget(event.target)) {
      clear()
    }
  }

  watch(
    container,
    (element, _previous, onCleanup) => {
      if (element === null) {
        return
      }

      element.addEventListener('pointerdown', onPointerdown)
      element.addEventListener('click', onClick)
      onCleanup(() => {
        element.removeEventListener('pointerdown', onPointerdown)
        element.removeEventListener('click', onClick)
      })
    },
    { immediate: true, flush: 'post' },
  )
}
