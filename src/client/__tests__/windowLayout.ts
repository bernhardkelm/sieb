import { vi, type Mock } from 'vitest'

export interface WindowLayout {
  /** Window.scrollTo stub, which moves the scroll position and fires a scroll event */
  scrollTo: Mock<(options: ScrollToOptions) => void>
  /** Current scroll position in px */
  scrollY: () => number
  restore: () => void
}

/**
 * Gives jsdom, which has no layout, the geometry a window virtualizer reads: a viewport of
 * 1024 by 768 px, rows carrying data-index with a fixed height, every other element without
 * height at the top of the page, a page as high as the list spacers and a window scroll position
 * that scrollTo moves.
 * @param {number} rowHeight - Height of every virtualized row in px
 * @returns {WindowLayout} - Scroll stub, scroll position and the restore action
 */
export const stubWindowLayout = (rowHeight: number): WindowLayout => {
  const original = HTMLElement.prototype.getBoundingClientRect
  const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!
  let scrollY = 0

  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    const height = this.hasAttribute('data-index') ? rowHeight : 0

    return DOMRect.fromRect({ x: 0, y: -scrollY, width: 1024, height })
  }

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-index') ? rowHeight : 0
    },
  })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () =>
      [...document.querySelectorAll<HTMLElement>('.origin')].reduce(
        (total, origin) => total + (Number.parseFloat(origin.style.height) || 0),
        0,
      ),
  })

  const scrollTo = vi.fn<(options: ScrollToOptions) => void>((options) => {
    scrollY = options.top ?? scrollY
    window.dispatchEvent(new Event('scroll'))
  })

  window.scrollTo = scrollTo as unknown as typeof window.scrollTo

  return {
    scrollTo,
    scrollY: () => scrollY,
    restore: () => {
      HTMLElement.prototype.getBoundingClientRect = original
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight)
      scrollY = 0
    },
  }
}
