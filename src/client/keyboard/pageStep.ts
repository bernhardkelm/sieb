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

export interface MeasuredRow {
  /** Offset of the row top in px, in the coordinates of the window scroll position */
  start: number
  /** Offset of the row bottom in px, in the same coordinates */
  end: number
}

/**
 * Returns how many rows PageUp and PageDown move from the measured rows of a virtualized list:
 * the rows fully inside the visible area, less one so the row at the edge stays visible.
 * @param {readonly MeasuredRow[]} rows - Rendered rows that take the cursor
 * @param {number} top - Top of the visible area in px
 * @param {number} bottom - Bottom of the visible area in px
 * @returns {number} - Rows per page, at least one, a fixed step when no row is visible
 */
export const pageStepOfRows = (
  rows: readonly MeasuredRow[],
  top: number,
  bottom: number,
): number => {
  const visible = rows.filter((row) => row.start >= top && row.end <= bottom).length

  return visible > 0 ? Math.max(1, visible - 1) : FALLBACK_STEP
}
