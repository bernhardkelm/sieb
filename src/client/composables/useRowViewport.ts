import type { Virtualizer } from '@tanstack/vue-virtual'
import { nextTick, type ComputedRef, type Ref } from 'vue'

import { registerListViewport, type ListViewport } from '@/composables/useListViewport'
import { pageStepOfRows } from '@/keyboard/pageStep'

export interface RowViewportOptions<T, K> {
  list: Readonly<Ref<HTMLElement | null>>
  virtualizer: Readonly<Ref<Virtualizer<Window, Element>>>
  /** Row index per key */
  indexes: ComputedRef<Map<K, number>>
  items: () => readonly T[]
  /** Whether a row takes the cursor, only those count for the page step */
  cursorRow: (item: T) => boolean
  /** Measures the list position again before a scroll */
  measureOrigin: () => void
}

/**
 * Builds the viewport of a virtualized list and hands it to the view: scrolling a row into view
 * through the virtualizer, which renders it, and the page step from the measured rows.
 * @param {RowViewportOptions<T, K>} options - List element, virtualizer and rows
 * @returns {ListViewport<K>} - Registered viewport
 */
export const useRowViewport = <T, K>(options: RowViewportOptions<T, K>): ListViewport<K> => {
  /**
   * Returns the rendered element of a row.
   * @param {K} key - Row key
   * @returns {HTMLElement | null} - Element, null when the row is not listed or not rendered
   */
  const elementOf = (key: K): HTMLElement | null => {
    const index = options.indexes.value.get(key)

    return index === undefined
      ? null
      : (options.list.value?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null)
  }

  const viewport: ListViewport<K> = {
    reveal: async (key) => {
      options.measureOrigin()
      await nextTick()

      const index = options.indexes.value.get(key)

      if (index === undefined) {
        return null
      }

      options.virtualizer.value.scrollToIndex(index, { align: 'auto' })
      await nextTick()
      return elementOf(key)
    },
    pageStep: () => {
      const items = options.items()
      const measured = options.virtualizer.value.getVirtualItems().filter((virtual) => {
        const item = items[virtual.index]

        return item !== undefined && options.cursorRow(item)
      })

      return pageStepOfRows(measured, window.scrollY, window.scrollY + window.innerHeight)
    },
  }

  registerListViewport(viewport)
  return viewport
}
