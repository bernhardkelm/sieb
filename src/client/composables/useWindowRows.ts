import { defaultRangeExtractor, useWindowVirtualizer, type Range } from '@tanstack/vue-virtual'
import {
  computed,
  nextTick,
  watch,
  type ComponentPublicInstance,
  type ComputedRef,
  type Ref,
} from 'vue'

import { indexByKey, withPinned } from '@/components/list/virtualRows'
import { useFocusedRow } from '@/composables/useFocusedRow'
import { useListOrigin } from '@/composables/useListOrigin'
import { useRowViewport } from '@/composables/useRowViewport'

const OVERSCAN = 8

/**
 * Measures the height of a row without rounding, so wrapped rows of fractional height line up
 * with the rows around them and with the stuck bars.
 * @param {Element} element - Row element
 * @param {ResizeObserverEntry | undefined} entry - Resize observer entry, absent on mount
 * @returns {number} - Height in px
 */
const measureHeight = (element: Element, entry: ResizeObserverEntry | undefined): number =>
  entry?.borderBoxSize[0]?.blockSize ?? element.getBoundingClientRect().height

export interface WindowRowsOptions<T, K> {
  items: () => readonly T[]
  keyOf: (item: T) => K
  /** Estimated height in px of a row until it is measured */
  estimate: (item: T, narrow: boolean) => number
  /** Row under the keyboard cursor, kept rendered wherever the list is scrolled */
  pinned: () => K | null
  /** Whether a row takes the cursor, only those count for the page step */
  cursorRow: (item: T) => boolean
}

export interface WindowRow<T, K> {
  key: K
  index: number
  item: T
  /** Offset of the row top inside the list element in px */
  offset: number
}

export interface WindowRows<T, K> {
  rows: ComputedRef<WindowRow<T, K>[]>
  /** Height of all rows in px, rendered or not */
  totalSize: ComputedRef<number>
  /** Template ref callback measuring a rendered row, which carries its data-index */
  measure: (target: unknown) => void
}

/**
 * Virtualizes the rows of a list the window scrolls: renders the rows around the visible area
 * plus an overscan, measures their real heights, keeps the cursor row and the focused row
 * rendered so focus never falls to the page body, and hands the view a viewport to scroll rows
 * that are not rendered into view.
 * @param {Readonly<Ref<HTMLElement | null>>} list - List element, the offset parent of the rows
 * @param {Readonly<Ref<HTMLElement | null>>} origin - Element marking where the rows start
 * @param {WindowRowsOptions<T, K>} options - Rows, their keys and size estimates
 * @returns {WindowRows<T, K>} - Rendered rows, total height and the measure callback
 */
export const useWindowRows = <T, K extends string | number>(
  list: Readonly<Ref<HTMLElement | null>>,
  origin: Readonly<Ref<HTMLElement | null>>,
  options: WindowRowsOptions<T, K>,
): WindowRows<T, K> => {
  const geometry = useListOrigin(list, origin)
  const focusedKey = useFocusedRow(list, options.items, options.keyOf)
  const indexes = computed(() => indexByKey(options.items(), options.keyOf))
  const pinned = computed(() =>
    [options.pinned(), focusedKey.value].map((key) =>
      key === null ? undefined : indexes.value.get(key),
    ),
  )
  const sizing = computed(() => {
    const items = options.items()
    const narrow = geometry.narrow.value

    return {
      count: items.length,
      estimateSize: (index: number) => options.estimate(items[index]!, narrow),
      getItemKey: (index: number) => options.keyOf(items[index]!),
    }
  })

  const virtualizer = useWindowVirtualizer(
    computed(() => {
      const pins = pinned.value

      return {
        ...sizing.value,
        overscan: OVERSCAN,
        measureElement: measureHeight,
        scrollMargin: geometry.scrollMargin.value,
        scrollPaddingStart: geometry.paddingStart.value,
        scrollPaddingEnd: geometry.paddingEnd.value,
        rangeExtractor: (range: Range) => withPinned(defaultRangeExtractor(range), pins),
      }
    }),
  )

  const rows = computed(() => {
    const instance = virtualizer.value
    const items = options.items()
    const shift = geometry.offset.value - instance.options.scrollMargin

    return instance
      .getVirtualItems()
      .filter((virtual) => items[virtual.index] !== undefined)
      .map((virtual) => ({
        key: virtual.key as K,
        index: virtual.index,
        item: items[virtual.index]!,
        offset: virtual.start + shift,
      }))
  })

  const totalSize = computed(() => virtualizer.value.getTotalSize())

  const observed = new WeakSet<HTMLElement>()

  /**
   * Measures a rendered row once as it mounts, called by Vue with the element or component
   * instance on every render; the resize observer of the virtualizer reports later changes.
   * @param {unknown} target - Row element or component instance, null on unmount
   * @returns {void}
   */
  const measure = (target: unknown): void => {
    const element =
      target instanceof Element ? target : (target as ComponentPublicInstance | null)?.$el

    if (!(element instanceof HTMLElement)) {
      virtualizer.value.measureElement(null)
    } else if (!observed.has(element)) {
      observed.add(element)
      virtualizer.value.measureElement(element)
    }
  }

  useRowViewport({
    list,
    virtualizer,
    indexes,
    items: options.items,
    cursorRow: options.cursorRow,
    measureOrigin: geometry.measure,
  })

  watch(geometry.narrow, async () => {
    virtualizer.value.measure()
    await nextTick()
    list.value
      ?.querySelectorAll<HTMLElement>('[data-index]')
      .forEach((row) => virtualizer.value.measureElement(row))
  })

  return { rows, totalSize, measure }
}
