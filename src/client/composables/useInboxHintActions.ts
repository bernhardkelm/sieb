import type { ComputedRef } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { isSeeable } from '@/components/inbox/inboxItems'
import { useHintActions } from '@/composables/useHintActions'
import type { ListCursor } from '@/composables/useListCursor'

export interface InboxHintSources {
  cursor: ListCursor<string>
  /** Listed items by key */
  items: ComputedRef<ReadonlyMap<string, InboxItem>>
  seenTargets: ComputedRef<string[]>
  markSeen: () => Promise<void>
}

export const NOTHING_TO_SEE = 'Only expiring decisions and new KEV listings can be marked as seen'

/**
 * Registers the Inbox hint actions: Mark as seen marks the checked items or the cursor item as
 * s does, Select checks the cursor item as x does; both only for expiring decisions and new KEV
 * listings, which leave the Inbox by being seen.
 * @param {InboxHintSources} sources - Cursor, items and the mark action
 * @returns {void}
 */
export const useInboxHintActions = ({
  cursor,
  items,
  seenTargets,
  markSeen,
}: InboxHintSources): void => {
  /**
   * Returns why the cursor item cannot be checked.
   * @returns {string | null} - Reason, null for an item that can be marked as seen
   */
  const notSelectable = (): string | null => {
    const key = cursor.currentKey.value
    const item = key === null ? undefined : items.value.get(key)

    return item && isSeeable(item) ? null : NOTHING_TO_SEE
  }

  useHintActions(
    {
      markSeen: {
        run: () => {
          void markSeen()
        },
        blockedBy: () => (seenTargets.value.length > 0 ? null : NOTHING_TO_SEE),
      },
      toggle: { run: cursor.toggleCurrent, blockedBy: notSelectable },
    },
    cursor.refocus,
  )
}
