import { inject, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { routeLocationKey } from 'vue-router'

import { panelClipOf } from '@/components/list/panelClip'

/** Marks a text cell of a list row that ends with an ellipsis at the side panel edge */
const PANEL_CLIP_ATTRIBUTE = 'data-panel-clip'

const SIDE_PANEL_SELECTOR = '.side-panel'

/**
 * Ends the marked text cells of a list at the left edge of a side panel overlaying the list, so
 * their text gets an ellipsis there instead of a hard cut, while the list keeps its columns. The
 * cells take the covered width as end padding. Runs after navigation (the panel opens through
 * the query), when the rendered rows change and on resize; lists rendered without a router only
 * follow rows and resize.
 * @param {Readonly<Ref<HTMLElement | null>>} list - List element
 * @param {() => unknown} rows - Rendered rows, watched for rows scrolled into the list
 * @returns {void}
 */
export const usePanelClip = (
  list: Readonly<Ref<HTMLElement | null>>,
  rows: () => unknown,
): void => {
  const route = inject(routeLocationKey, null)
  let observer: ResizeObserver | null = null
  let clipped = false

  /**
   * Measures the panel edge and the marked cells, then sets their end padding.
   * @returns {void}
   */
  const apply = (): void => {
    const element = list.value

    if (element === null) {
      return
    }

    const panel = document.querySelector<HTMLElement>(SIDE_PANEL_SELECTOR)

    if (panel === null && !clipped) {
      return
    }

    // offsetLeft of the fixed panel ignores its slide-in transform
    const edge =
      panel !== null && panel.offsetLeft > element.getBoundingClientRect().left
        ? panel.offsetLeft
        : null
    const cells = [...element.querySelectorAll<HTMLElement>(`[${PANEL_CLIP_ATTRIBUTE}]`)]
    const clips = cells.map((cell) =>
      edge === null ? 0 : panelClipOf(cell.getBoundingClientRect(), edge),
    )

    clipped = edge !== null

    cells.forEach((cell, index) => {
      const clip = clips[index] ?? 0

      if (clip > 0) {
        cell.style.setProperty('padding-inline-end', `${clip}px`)
      } else {
        cell.style.removeProperty('padding-inline-end')
      }
    })
  }

  watch([() => route?.fullPath, rows], apply, { flush: 'post' })

  onMounted(() => {
    apply()
    window.addEventListener('resize', apply)

    if (typeof ResizeObserver !== 'undefined' && list.value !== null) {
      observer = new ResizeObserver(apply)
      observer.observe(list.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', apply)
    observer?.disconnect()
  })
}
