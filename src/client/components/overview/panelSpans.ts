import type { StatPanelModel } from '@/components/overview/statPanels'

export interface PanelSpan {
  wide: boolean // spans both columns of the full grid
  wideWhenShort: boolean // spans both columns while the short sidebar shows only primary panels
}

/**
 * Returns whether the panel at an index is the last of an odd count, so it would sit alone in
 * the last row of the two column grid.
 * @param {number} index - Position of the panel
 * @param {number} count - Number of panels in the grid
 * @returns {boolean} - True for the lone last panel
 */
const isLoneLast = (index: number, count: number): boolean => count % 2 === 1 && index === count - 1

/**
 * Lays out the overview panels in two columns: a lone last panel spans both columns, once for
 * the full grid and once for the primary panels a short sidebar keeps, which lead the order.
 * @param {Pick<StatPanelModel, 'primary'>[]} panels - Panels in display order
 * @returns {PanelSpan[]} - Span of each panel, in the same order
 */
export const panelSpans = (panels: Pick<StatPanelModel, 'primary'>[]): PanelSpan[] => {
  const primaryCount = panels.filter((panel) => panel.primary).length

  return panels.map((panel, index) => ({
    wide: isLoneLast(index, panels.length),
    wideWhenShort: panel.primary && isLoneLast(index, primaryCount),
  }))
}
