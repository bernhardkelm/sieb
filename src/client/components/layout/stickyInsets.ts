export const STICKY_EDGE_ATTRIBUTE = 'data-sticky-edge'

export type StickyEdge = 'top' | 'bottom'

export interface StickyInsets {
  /** Height in px the bars stuck to the top of the window cover */
  top: number
  /** Height in px the bars stuck to the bottom of the window cover */
  bottom: number
}

/**
 * Returns how far a bar covers the window from its edge while it is stuck: its sticky or fixed
 * offset plus its height, nothing while it scrolls with the page or has no offset on that edge.
 * @param {HTMLElement} element - Bar marked with the sticky edge attribute
 * @param {StickyEdge} edge - Window edge the bar sticks to
 * @returns {number} - Covered height in px
 */
export const stickyCover = (element: HTMLElement, edge: StickyEdge): number => {
  const style = getComputedStyle(element)
  const offset = parseFloat(edge === 'top' ? style.top : style.bottom)

  if ((style.position !== 'sticky' && style.position !== 'fixed') || Number.isNaN(offset)) {
    return 0
  }

  return Math.ceil(offset + element.getBoundingClientRect().height)
}

/**
 * Measures how much of the window the stuck bars cover at the top and the bottom, such as the
 * top bar, the view toolbar, the selection bar and the bottom navigation, so scrolling a row
 * into view can keep it clear of them.
 * @returns {StickyInsets} - Covered heights in px
 */
export const stickyInsets = (): StickyInsets => {
  const insets: StickyInsets = { top: 0, bottom: 0 }

  for (const element of document.querySelectorAll<HTMLElement>(`[${STICKY_EDGE_ATTRIBUTE}]`)) {
    const edge = element.getAttribute(STICKY_EDGE_ATTRIBUTE)

    if (edge === 'top' || edge === 'bottom') {
      insets[edge] = Math.max(insets[edge], stickyCover(element, edge))
    }
  }

  return insets
}
