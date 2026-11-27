import { computed, watch, type ComputedRef, type Ref } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { isSeeable, isSelectable } from '@/components/inbox/inboxItems'
import type { ListSelection } from '@/composables/useListSelection'
import { useInboxStore } from '@/stores/inboxStore'

export interface InboxSeen {
  /** Items s marks as seen: the checked seeable ones, else the cursor item when it can be seen */
  seenTargets: ComputedRef<string[]>
  /** Marks items as seen and unchecks their rows, the seen targets when no keys are given */
  markSeen: (keys?: readonly string[]) => Promise<void>
}

/**
 * Handles marking Inbox items as seen on the list selection. Only proposals, expiring decisions
 * and new KEV listings stay checked, so Space, x, Shift ranges and select all skip re-opened
 * decisions, which leave the Inbox by being decided; of the checked items only the expiring and
 * KEV ones can be marked as seen, the proposals stay checked for accept and reject.
 * @param {ListSelection<string>} selection - Cursor and checked rows of the list
 * @param {Readonly<Ref<ReadonlyMap<string, InboxItem>>>} byKey - Listed items by key
 * @returns {InboxSeen} - Targets and the mark action
 */
export const useInboxSeen = (
  selection: ListSelection<string>,
  byKey: Readonly<Ref<ReadonlyMap<string, InboxItem>>>,
): InboxSeen => {
  const store = useInboxStore()

  /**
   * Returns whether a key names a listed item that can be marked as seen.
   * @param {string} key - Item key
   * @returns {boolean} - True for a listed expiring or KEV item
   */
  const seeable = (key: string): boolean => {
    const item = byKey.value.get(key)

    return item !== undefined && isSeeable(item)
  }

  const seenTargets = computed(() => {
    const checked = selection.checkedInOrder.value
    const key = selection.currentId.value

    if (checked.length > 0) {
      return checked.filter(seeable)
    }

    return key !== null && seeable(key) ? [key] : []
  })

  /**
   * Marks items as seen and unchecks their rows.
   * @param {readonly string[]} keys - Item keys, the seen targets when omitted
   * @returns {Promise<void>} - Resolves once the server answered
   */
  const markSeen = async (keys: readonly string[] = seenTargets.value): Promise<void> => {
    if (keys.length === 0) {
      return
    }

    const marked = new Set(keys)
    const done = store.markSeen(keys)

    selection.checkedIds.value = new Set(
      [...selection.checkedIds.value].filter((key) => !marked.has(key)),
    )
    await done
  }

  watch(
    selection.checkedIds,
    (checked) => {
      const kept = [...checked].filter((key) => {
        const item = byKey.value.get(key)

        return item !== undefined && isSelectable(item)
      })

      if (kept.length !== checked.size) {
        selection.checkedIds.value = new Set(kept)
      }
    },
    { flush: 'sync' },
  )

  return { seenTargets, markSeen }
}
