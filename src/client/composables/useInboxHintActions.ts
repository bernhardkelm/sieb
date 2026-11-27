import type { ComputedRef } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { NOTHING_TO_SEE } from '@/components/inbox/inboxBulkTargets'
import { isSelectable } from '@/components/inbox/inboxItems'
import type { InboxBulk } from '@/composables/useInboxBulk'
import { useHintActions } from '@/composables/useHintActions'
import type { ListCursor } from '@/composables/useListCursor'

export interface InboxHintSources {
  cursor: ListCursor<string>
  /** Listed items by key */
  items: ComputedRef<ReadonlyMap<string, InboxItem>>
  seenTargets: ComputedRef<string[]>
  markSeen: () => Promise<void>
  bulk: InboxBulk
}

export const NOT_SELECTABLE = 'Re-opened decisions are decided one by one'

/**
 * Registers the Inbox hint actions: Accept and Reject open the dialogs for the checked
 * proposals as a and d do, Mark as seen marks the checked or the cursor item as s does, Select
 * and Select all check items as x and the select-all chord do; re-opened decisions are never
 * checked.
 * @param {InboxHintSources} sources - Cursor, items, the mark action and the bulk actions
 * @returns {void}
 */
export const useInboxHintActions = ({
  cursor,
  items,
  seenTargets,
  markSeen,
  bulk,
}: InboxHintSources): void => {
  /**
   * Returns why the cursor item cannot be checked.
   * @returns {string | null} - Reason, null for an item a bulk action applies to
   */
  const notSelectable = (): string | null => {
    const key = cursor.currentKey.value
    const item = key === null ? undefined : items.value.get(key)

    if (item === undefined) {
      return 'No item under the cursor'
    }

    return isSelectable(item) ? null : NOT_SELECTABLE
  }

  useHintActions(
    {
      accept: { run: bulk.openAccept, blockedBy: () => bulk.acceptBlockedBy.value },
      reject: { run: bulk.openReject, blockedBy: () => bulk.rejectBlockedBy.value },
      markSeen: {
        run: () => {
          void markSeen()
        },
        blockedBy: () => (seenTargets.value.length > 0 ? null : NOTHING_TO_SEE),
      },
      toggle: { run: cursor.toggleCurrent, blockedBy: notSelectable },
      selectAll: {
        run: cursor.selection.checkAll,
        blockedBy: () => (items.value.size === 0 ? 'No items listed' : null),
      },
    },
    cursor.refocus,
  )
}
