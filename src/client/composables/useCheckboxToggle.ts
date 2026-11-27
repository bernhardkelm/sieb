import { useCursorRefocus } from '@/composables/useCursorRefocus'
import type { ListCursor } from '@/composables/useListCursor'
import { rowClickIntent } from '@/keyboard/rowClick'

/**
 * Handles a click on the checkbox of a row: Shift checks the range from the anchor as a Shift
 * click on the row does, every other click checks or unchecks the row and anchors there, leaving
 * cursor and panel where they are and focus on the cursor row.
 * @param {ListCursor<K>} cursor - Cursor of the list
 * @param {(key: K) => HTMLElement | null} rowOf - Rendered row element of a key
 * @returns {(key: K, event?: MouseEvent) => void} - Click handler of the checkbox
 */
export const useCheckboxToggle = <K>(
  cursor: ListCursor<K>,
  rowOf: (key: K) => HTMLElement | null,
): ((key: K, event?: MouseEvent) => void) => {
  const refocusCursor = useCursorRefocus(cursor.currentKey, rowOf)

  return (key, event) => {
    if (rowClickIntent(event, true) === 'range') {
      cursor.click(key, event)
    } else {
      cursor.selection.toggleChecked(key)
      refocusCursor()
    }
  }
}
