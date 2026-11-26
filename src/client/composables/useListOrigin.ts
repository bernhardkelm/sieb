import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import { stickyInsets } from '@/components/layout/stickyInsets'
import { NARROW_LIST_WIDTH } from '@/components/list/virtualRows'

export interface ListOrigin {
  /** Page offset of the first virtualized row in px, the scrollMargin of a window virtualizer */
  scrollMargin: Ref<number>
  /** Offset of the first virtualized row inside the list element in px, below any header row */
  offset: Ref<number>
  /** Whether the list is narrow enough for its rows to wrap to two lines */
  narrow: Ref<boolean>
  /** Room in px scrolling keeps above a row, the height the bars stuck to the top cover */
  paddingStart: Ref<number>
  /** Room in px scrolling keeps below a row, the height the bars stuck to the bottom cover */
  paddingEnd: Ref<number>
  /** Measures again, for example right before a scroll */
  measure: () => void
}

/**
 * Measures where the virtualized rows of a list start on the page and how much room scrolling
 * keeps around a row so the stuck bars never cover it, again whenever the page or the list
 * resizes, as content above the list such as the summary or a wrapping filter bar moves it.
 * @param {Readonly<Ref<HTMLElement | null>>} list - List element, the offset parent of the rows
 * @param {Readonly<Ref<HTMLElement | null>>} origin - Element marking where the rows start
 * @returns {ListOrigin} - Measured values and the measure action
 */
export const useListOrigin = (
  list: Readonly<Ref<HTMLElement | null>>,
  origin: Readonly<Ref<HTMLElement | null>>,
): ListOrigin => {
  const scrollMargin = ref(0)
  const offset = ref(0)
  const narrow = ref(false)
  const paddingStart = ref(0)
  const paddingEnd = ref(0)
  let observer: ResizeObserver | null = null

  /**
   * Measures the origin, the width and the room the stuck bars cover.
   * @returns {void}
   */
  const measure = (): void => {
    const listElement = list.value
    const originElement = origin.value

    if (listElement === null || originElement === null) {
      return
    }

    scrollMargin.value = originElement.getBoundingClientRect().top + window.scrollY
    offset.value = originElement.offsetTop
    narrow.value = listElement.clientWidth > 0 && listElement.clientWidth < NARROW_LIST_WIDTH

    const insets = stickyInsets()

    paddingStart.value = insets.top
    paddingEnd.value = insets.bottom
  }

  onMounted(() => {
    measure()
    window.addEventListener('resize', measure)

    if (typeof ResizeObserver !== 'undefined' && list.value !== null) {
      observer = new ResizeObserver(measure)
      observer.observe(document.body)
      observer.observe(list.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', measure)
    observer?.disconnect()
  })

  return { scrollMargin, offset, narrow, paddingStart, paddingEnd, measure }
}
