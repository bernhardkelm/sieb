import { onBeforeUnmount, onMounted, type Ref } from 'vue'

export const SHEET_QUERY = '(max-width: 639px)' // the side panel turns into a full screen sheet

// a press here keeps the panel: other side panels, list rows, dialogs, menus, popovers, toasts
const KEEP_SELECTOR = [
  '.side-panel',
  '[role="option"]',
  '[role="row"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[data-reka-popper-content-wrapper]',
  '[data-swipe-direction]',
].join(', ')

/**
 * Returns whether a dialog, menu or popover is open; its own outside press closes it first.
 * Tooltips do not count, they open on hover.
 * @returns {boolean} - True while such a layer is open
 */
const layerOpen = (): boolean =>
  document.querySelector('[role="dialog"], [role="alertdialog"]') !== null ||
  [...document.querySelectorAll('[data-reka-popper-content-wrapper]')].some(
    (layer) => layer.querySelector('[role="tooltip"]') === null,
  )

/**
 * Returns whether a pointer press should close an overlay panel: a primary button press on the
 * page outside the panel and outside the elements in KEEP_SELECTOR, while no other layer is
 * open and the panel is no full screen sheet. A press on the page scrollbar targets the html
 * element and never counts.
 * @param {PointerEvent} event - Pointer press
 * @param {HTMLElement} panel - Panel element
 * @returns {boolean} - True for a press outside
 */
export const isOutsidePress = (event: PointerEvent, panel: HTMLElement): boolean => {
  const target = event.target

  if (event.button !== 0 || !(target instanceof Element) || target === document.documentElement) {
    return false
  }

  if (panel.contains(target) || target.closest(KEEP_SELECTOR) !== null || layerOpen()) {
    return false
  }

  return typeof window.matchMedia !== 'function' || !window.matchMedia(SHEET_QUERY).matches
}

/**
 * Closes an overlay side panel on a pointer press outside of it, see isOutsidePress. The
 * close runs through the router, so the draft guard of the decision form still asks.
 * @param {Readonly<Ref<HTMLElement | null>>} panel - Panel element, null while closed
 * @param {() => void} dismiss - Closes the panel
 * @param {() => boolean} enabled - Whether an outside press may close the panel now
 * @returns {void}
 */
export const usePanelDismiss = (
  panel: Readonly<Ref<HTMLElement | null>>,
  dismiss: () => void,
  enabled: () => boolean = () => true,
): void => {
  /**
   * Closes the panel for a press outside of it.
   * @param {PointerEvent} event - Pointer press anywhere on the page
   * @returns {void}
   */
  const onPointerdown = (event: PointerEvent): void => {
    if (panel.value !== null && enabled() && isOutsidePress(event, panel.value)) {
      dismiss()
    }
  }

  onMounted(() => {
    window.addEventListener('pointerdown', onPointerdown, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onPointerdown, true)
  })
}
