import type { ComputedRef } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { NOTHING_TO_SEE } from '@/components/inbox/inboxBulkTargets'
import type { InboxBulkCounts } from '@/components/inbox/inboxBulkCounts'
import { isSelectable } from '@/components/inbox/inboxItems'
import type { InboxBulk } from '@/composables/useInboxBulk'
import { useHintActions } from '@/composables/useHintActions'
import type { ListCursor } from '@/composables/useListCursor'
import type { BulkNoun } from '@/format/bulkCount'
import type { HintBulk } from '@/keyboard/hintActions'

export interface InboxHintSources {
  cursor: ListCursor<string>
  /** Listed items by key */
  items: ComputedRef<ReadonlyMap<string, InboxItem>>
  seenTargets: ComputedRef<string[]>
  markSeen: () => Promise<void>
  bulk: InboxBulk
}

export const NOT_SELECTABLE = 'Re-opened decisions are decided one by one'

const PROPOSAL: BulkNoun = { singular: 'proposal' }
const ITEM: BulkNoun = { singular: 'item' }

/**
 * Registers the Inbox hint actions: Accept and Reject open the dialogs for the checked
 * proposals as a and d do, Mark as seen marks the checked or the cursor item as s does, Select
 * and Select all check items as x and the select-all chord do; re-opened decisions are never
 * checked. With checked items the three actions count the items they act on.
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

  /**
   * Returns the checked items an action acts on.
   * @param {keyof InboxBulkCounts} action - Bulk action
   * @param {BulkNoun} noun - Noun of the counted items
   * @returns {() => HintBulk | null} - Count and noun, null without checked items
   */
  const counted =
    (action: keyof InboxBulkCounts, noun: BulkNoun): (() => HintBulk | null) =>
    () =>
      cursor.selection.checkedIds.value.size > 0 ? { count: bulk.counts.value[action], noun } : null

  useHintActions(
    {
      accept: {
        run: bulk.openAccept,
        blockedBy: () => bulk.acceptBlockedBy.value,
        bulk: counted('accept', PROPOSAL),
      },
      reject: {
        run: bulk.openReject,
        blockedBy: () => bulk.rejectBlockedBy.value,
        bulk: counted('reject', PROPOSAL),
      },
      markSeen: {
        run: () => {
          void markSeen()
        },
        blockedBy: () => (seenTargets.value.length > 0 ? null : NOTHING_TO_SEE),
        bulk: counted('markSeen', ITEM),
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
