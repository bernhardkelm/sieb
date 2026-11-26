import { ROW_KEY_ATTRIBUTE } from '@/keyboard/rowKey'
import { shortcutScope } from '@/keyboard/keyboardTarget'

/**
 * Scrolls a list row into view and focuses it, unless focus sits in the side panel.
 * @param {HTMLElement | null} row - Row element, null does nothing
 * @returns {void}
 */
export const revealRow = (row: HTMLElement | null): void => {
  row?.scrollIntoView({ block: 'nearest' })

  if (row && shortcutScope(document.activeElement) !== 'panel') {
    row.focus({ preventScroll: true })
  }
}

/**
 * Finds the row element carrying a row key.
 * @param {string} key - Row key
 * @returns {HTMLElement | null} - Row element, null when it is not rendered
 */
export const rowByKey = (key: string): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>(`[${ROW_KEY_ATTRIBUTE}]`)].find(
    (row) => row.getAttribute(ROW_KEY_ATTRIBUTE) === key,
  ) ?? null
