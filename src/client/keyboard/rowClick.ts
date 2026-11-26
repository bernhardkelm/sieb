import { hasCommandModifier } from '@/keyboard/modifierKey'

export type RowClickIntent = 'open' | 'toggle' | 'range'

/**
 * Reads what a click on a list row asks for. In lists with multiple selection Shift selects the
 * range from the anchor and Cmd, Ctrl outside Apple platforms, checks or unchecks one row;
 * every other click opens the row.
 * @param {Pick<MouseEvent, 'shiftKey' | 'metaKey' | 'ctrlKey'> | undefined} event - Click, undefined for synthetic selects
 * @param {boolean} multiselect - Whether the list checks rows for bulk actions
 * @param {boolean | undefined} apple - Whether the platform is an Apple one, detected when omitted
 * @returns {RowClickIntent} - Intent of the click
 */
export const rowClickIntent = (
  event: Pick<MouseEvent, 'shiftKey' | 'metaKey' | 'ctrlKey'> | undefined,
  multiselect: boolean,
  apple?: boolean,
): RowClickIntent => {
  if (!event || !multiselect) {
    return 'open'
  }

  if (event.shiftKey) {
    return 'range'
  }

  return hasCommandModifier(event, apple) ? 'toggle' : 'open'
}
