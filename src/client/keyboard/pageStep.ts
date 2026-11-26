const FALLBACK_STEP = 10

/**
 * Returns how many rows PageUp and PageDown move: one viewport of rows, less one so the row at
 * the edge stays visible for orientation.
 * @param {number} viewportHeight - Height of the visible area in px
 * @param {number} rowHeight - Height of one row in px
 * @returns {number} - Rows per page, at least one, a fixed step when nothing is measured
 */
export const pageStepFor = (viewportHeight: number, rowHeight: number): number =>
  viewportHeight > 0 && rowHeight > 0
    ? Math.max(1, Math.floor(viewportHeight / rowHeight) - 1)
    : FALLBACK_STEP

/**
 * Measures the page step of a list from one of its rows and the window, which scrolls the lists.
 * @param {HTMLElement | null} row - Rendered row, null falls back to a fixed step
 * @returns {number} - Rows per page
 */
export const pageStepOf = (row: HTMLElement | null): number =>
  pageStepFor(window.innerHeight, row?.getBoundingClientRect().height ?? 0)
