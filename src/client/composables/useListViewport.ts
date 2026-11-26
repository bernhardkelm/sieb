import {
  inject,
  onBeforeUnmount,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue'

/** Scrolling of a virtualized list, which renders only the rows around the visible area */
export interface ListViewport<K> {
  /** Scrolls a row into view, resolves with its element once rendered, null when not listed */
  reveal(key: K): Promise<HTMLElement | null>
  /** Rows PageUp and PageDown move, measured from the rendered rows */
  pageStep(): number
}

const LIST_VIEWPORT: InjectionKey<ShallowRef<ListViewport<unknown> | null>> = Symbol('listViewport')

/**
 * Provides a slot for the viewport of the list a view renders, so the cursor of the view can
 * scroll rows that are not rendered into view. Stays empty while no virtualized list is mounted.
 * @returns {ShallowRef<ListViewport<K> | null>} - Viewport of the mounted list, null before
 */
export const provideListViewport = <K>(): ShallowRef<ListViewport<K> | null> => {
  const viewport = shallowRef<ListViewport<unknown> | null>(null)

  provide(LIST_VIEWPORT, viewport)
  return viewport as ShallowRef<ListViewport<K> | null>
}

/**
 * Hands the viewport of a mounted list to the view that provided the slot, for as long as the
 * list stays mounted. Does nothing outside such a view.
 * @param {ListViewport<K>} viewport - Viewport of the list
 * @returns {void}
 */
export const registerListViewport = <K>(viewport: ListViewport<K>): void => {
  const slot = inject(LIST_VIEWPORT, null)

  if (slot === null) {
    return
  }

  slot.value = viewport as ListViewport<unknown>

  onBeforeUnmount(() => {
    if (slot.value === viewport) {
      slot.value = null
    }
  })
}
