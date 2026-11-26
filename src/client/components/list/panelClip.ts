/**
 * Returns how much of a text cell a side panel covers from its end, the end padding that moves
 * its ellipsis to the panel edge.
 * @param {Pick<DOMRect, 'left' | 'right'>} cell - Cell box in viewport coordinates
 * @param {number} edge - Left edge of the panel in viewport px
 * @returns {number} - Covered width in whole px, 0 when the panel leaves the cell free, at most the cell width
 */
export const panelClipOf = (cell: Pick<DOMRect, 'left' | 'right'>, edge: number): number =>
  Math.ceil(Math.min(Math.max(cell.right - edge, 0), cell.right - cell.left))
