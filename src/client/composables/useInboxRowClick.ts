import type { InboxItem } from '#core/inbox/inboxItem.ts'
import type { ListCursor } from '@/composables/useListCursor'

export interface InboxRowClickSources {
  cursor: ListCursor<string>
  /** Listed item of a key, undefined for keys no longer listed */
  itemOf: (key: string) => InboxItem | undefined
  /** Puts the cursor on an item and opens it in its panel */
  openAt: (key: string, item: InboxItem) => Promise<void>
}

/**
 * Handles clicks on Inbox rows as in Triage: Shift checks the range from the anchor, Cmd or Ctrl
 * checks or unchecks the row, a plain click puts the cursor on the row and opens it.
 * @param {InboxRowClickSources} sources - Cursor, item lookup and open
 * @returns {(key: string, event?: MouseEvent) => void} - Row click handler
 */
export const useInboxRowClick = ({
  cursor,
  itemOf,
  openAt,
}: InboxRowClickSources): ((key: string, event?: MouseEvent) => void) => {
  return (key, event) => {
    const item = itemOf(key)

    if (cursor.click(key, event) || !item) {
      return
    }

    void openAt(key, item)
  }
}
