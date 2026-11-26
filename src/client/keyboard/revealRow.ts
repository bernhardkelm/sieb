import { ROW_KEY_ATTRIBUTE } from '@/keyboard/rowKey'
import { shortcutScope } from '@/keyboard/keyboardTarget'

/**
 * Focuses a list row without scrolling, unless focus sits in the side panel.
 * @param {HTMLElement | null} row - Row element, null does nothing
 * @returns {void}
 */
export const focusRow = (row: HTMLElement | null): void => {
  if (row && shortcutScope(document.activeElement) !== 'panel') {
    row.focus({ preventScroll: true })
  }
}

/**
 * Scrolls a list row into view and focuses it, unless focus sits in the side panel.
 * @param {HTMLElement | null} row - Row element, null does nothing
 * @returns {void}
 */
export const revealRow = (row: HTMLElement | null): void => {
  row?.scrollIntoView({ block: 'nearest' })
  focusRow(row)
}

/**
 * Finds the rendered row element carrying a row key.
 * @param {string} key - Row key
 * @returns {HTMLElement | null} - Row element, null when it is not rendered
 */
export const rowByKey = (key: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[${ROW_KEY_ATTRIBUTE}="${CSS.escape(key)}"]`)
