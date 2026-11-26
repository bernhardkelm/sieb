import { computed, watch, type ComputedRef, type Ref } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { isSeeable } from '@/components/inbox/inboxItems'
import type { ListSelection } from '@/composables/useListSelection'
import { useInboxStore } from '@/stores/inboxStore'

export interface InboxSeen {
  /** Items s marks as seen: the checked ones, else the cursor item when it can be seen */
  seenTargets: ComputedRef<string[]>
  /** Marks items as seen and unchecks the rows, the seen targets when no keys are given */
  markSeen: (keys?: readonly string[]) => Promise<void>
}

/**
 * Handles marking Inbox items as seen on the list selection. Only expiring decisions and new
 * KEV listings stay checked, so Space, x, Shift ranges and select all skip proposals and
 * re-opened decisions, which leave the Inbox by being handled.
 * @param {ListSelection<string>} selection - Cursor and checked rows of the list
 * @param {Readonly<Ref<ReadonlyMap<string, InboxItem>>>} byKey - Listed items by key
 * @returns {InboxSeen} - Targets and the mark action
 */
export const useInboxSeen = (
  selection: ListSelection<string>,
  byKey: Readonly<Ref<ReadonlyMap<string, InboxItem>>>,
): InboxSeen => {
  const store = useInboxStore()

  const seenTargets = computed(() => {
    const checked = selection.checkedInOrder.value
    const key = selection.currentId.value
    const item = key === null ? undefined : byKey.value.get(key)

    if (checked.length > 0) {
      return checked
    }

    return item && isSeeable(item) ? [item.key] : []
  })

  /**
   * Marks items as seen and unchecks the rows.
   * @param {readonly string[]} keys - Item keys, the seen targets when omitted
   * @returns {Promise<void>} - Resolves once the server answered
   */
  const markSeen = async (keys: readonly string[] = seenTargets.value): Promise<void> => {
    if (keys.length === 0) {
      return
    }

    const done = store.markSeen(keys)

    selection.clearChecked()
    await done
  }

  watch(
    selection.checkedIds,
    (checked) => {
      const kept = [...checked].filter((key) => {
        const item = byKey.value.get(key)

        return item !== undefined && isSeeable(item)
      })

      if (kept.length !== checked.size) {
        selection.checkedIds.value = new Set(kept)
      }
    },
    { flush: 'sync' },
  )

  return { seenTargets, markSeen }
}
