import { nextTick, watch, type Ref } from 'vue'

import { useFindingDetailStore } from '@/stores/findingDetailStore'

/**
 * Loads the finding of the side panel and moves focus with it: into the panel when it opens, and
 * back to the row of the finding, or to the element focused before the panel opened, once it
 * closes and focus left with it. Focus a press outside the panel put elsewhere stays there.
 * @param {Readonly<Ref<string | null>>} findingId - Finding id of the panel, null while closed
 * @param {Readonly<Ref<HTMLElement | null>>} panel - Panel element
 * @returns {() => void} - Focuses the panel itself
 */
export const usePanelFocus = (
  findingId: Readonly<Ref<string | null>>,
  panel: Readonly<Ref<HTMLElement | null>>,
): (() => void) => {
  const store = useFindingDetailStore()
  let opener: Element | null = null

  /**
   * Moves focus back to the row of a finding, or to the opener, once focus left with the panel.
   * @param {string} id - Finding id of the closed panel
   * @returns {void}
   */
  const restoreFocus = (id: string): void => {
    if (document.activeElement !== null && document.activeElement !== document.body) {
      opener = null
      return
    }

    const row = document.querySelector<HTMLElement>(`[data-finding-id="${CSS.escape(id)}"]`)
    const target = row ?? (opener instanceof HTMLElement && opener.isConnected ? opener : null)

    target?.focus({ preventScroll: false })
    opener = null
  }

  /**
   * Focuses the panel itself.
   * @returns {void}
   */
  const focusPanel = (): void => {
    panel.value?.focus({ preventScroll: true })
  }

  watch(
    findingId,
    async (id, previous) => {
      if (id === null) {
        store.clear()

        if (previous) {
          await nextTick()
          restoreFocus(previous)
        }

        return
      }

      void store.load(Number(id))

      if (!previous) {
        opener = document.activeElement
        await nextTick()
        focusPanel()
      }
    },
    { immediate: true },
  )

  return focusPanel
}
