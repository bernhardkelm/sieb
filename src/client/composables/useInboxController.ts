import { computed, onMounted, ref, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import type { InboxFilters } from '@/components/inbox/inboxFilters'
import { useCheckboxToggle } from '@/composables/useCheckboxToggle'
import { useInboxBulk, type InboxBulk } from '@/composables/useInboxBulk'
import { useInboxCursorPanels } from '@/composables/useInboxCursorPanels'
import { useInboxHintActions } from '@/composables/useInboxHintActions'
import { useInboxItemLink } from '@/composables/useInboxItemLink'
import { useInboxItems } from '@/composables/useInboxItems'
import { useInboxKeyActions } from '@/composables/useInboxKeyActions'
import { useInboxPanels } from '@/composables/useInboxPanels'
import { useInboxRowClick } from '@/composables/useInboxRowClick'
import { useInboxSeen } from '@/composables/useInboxSeen'
import { useListCursor } from '@/composables/useListCursor'
import { inboxActionFor } from '@/keyboard/inboxKeymap'
import { useInboxStore } from '@/stores/inboxStore'

export interface InboxController {
  /** Filter bar state, kept in the query */
  filters: WritableComputedRef<InboxFilters>
  resetFilters: () => Promise<void>
  /** Items passing the filters, what the list, the cursor and the bulk actions work on */
  items: ComputedRef<InboxItem[]>
  currentKey: Ref<string | null>
  checkedKeys: Ref<Set<string>>
  proposalId: ComputedRef<number | null>
  /** Items s marks as seen: the checked ones, else the cursor item when it can be seen */
  seenTargets: ComputedRef<string[]>
  /** Bulk accept and reject of the checked proposals */
  bulk: InboxBulk
  select: (key: string, event?: MouseEvent) => void
  toggleChecked: (key: string, event?: MouseEvent) => void
  markSeen: (keys?: readonly string[]) => Promise<void>
  clearChecked: () => void
  closeProposal: () => Promise<void>
  onResolved: () => Promise<void>
}

/**
 * Drives the Inbox on the shared list cursor: j and k move, Enter or o opens the cursor item in
 * its panel, Escape closes the topmost panel, Space, x, select all and the Shift and modifier
 * clicks check proposals, expiring decisions and KEV listings, a and d open the bulk accept and
 * reject of the checked proposals, and s marks the checked items, or the cursor item, as
 * seen. A key move closes an open review and never opens one; a resolved proposal closes the
 * review panel and refetches the Inbox, focus lands on the next row and the next review opens
 * only on Enter or a click. A link with `?item=<key>` starts the cursor on that item. The filter
 * query params (see useInboxFilterQuery) narrow the listed items, select all and the bulk
 * actions only reach those, and / focuses the search.
 * @param {() => void} focusSearch - Focuses the search input of the filter bar
 * @returns {InboxController} - State and actions for the Inbox view
 */
export const useInboxController = (focusSearch: () => void): InboxController => {
  const store = useInboxStore()
  const listed = useInboxItems()
  const { items, keys, byKey, rowOf } = listed

  const dialogs = { acceptOpen: ref(false), rejectOpen: ref(false) }

  const cursor = useListCursor<string>({
    keys,
    findingIdOf: listed.findingIdOf,
    keyOfFinding: listed.keyOfFinding,
    rowOf,
    multiselect: true,
    paused: () => dialogs.acceptOpen.value || dialogs.rejectOpen.value,
    handleKey: (event, scope) => {
      const action = inboxActionFor(event, scope)

      return action !== null && run(action)
    },
  })

  const { currentKey, selection } = cursor
  const panels = useInboxPanels(currentKey, items, cursor.refocus)
  const { openAt } = useInboxCursorPanels(currentKey, items, panels, cursor.refocus)
  const toggleChecked = useCheckboxToggle(cursor, rowOf)

  const { seenTargets, markSeen } = useInboxSeen(selection, byKey)

  /**
   * Refetches the Inbox after a bulk action and focuses the cursor row, which moved on once its
   * row left.
   * @returns {Promise<void>} - Resolves once focused
   */
  const refetch = async (): Promise<void> => {
    await store.refresh()
    await cursor.refocus()
  }

  const bulk = useInboxBulk(selection, byKey, refetch, dialogs)

  const run = useInboxKeyActions({
    current: () => (currentKey.value === null ? undefined : byKey.value.get(currentKey.value)),
    panels,
    bulk,
    markSeen: () => markSeen(),
    focusSearch,
  })
  const select = useInboxRowClick({
    cursor,
    itemOf: (key) => byKey.value.get(key),
    openAt,
  })

  /**
   * Closes the review panel after a proposal was accepted or rejected, refetches the Inbox and
   * focuses the cursor row, which moved to the next row once the resolved one left.
   * @returns {Promise<void>} - Resolves once focused
   */
  const onResolved = async (): Promise<void> => {
    await panels.closeProposal()
    await refetch()
  }

  useInboxHintActions({ cursor, items: byKey, seenTargets, markSeen, bulk, focusSearch })
  useInboxItemLink(
    keys,
    computed(() => store.loaded),
    cursor.focusKey,
  )

  onMounted(() => {
    void store.ensureLoaded()
  })

  return {
    filters: listed.filters,
    resetFilters: listed.resetFilters,
    items,
    currentKey,
    checkedKeys: selection.checkedIds,
    proposalId: panels.proposalId,
    seenTargets,
    bulk,
    select,
    toggleChecked,
    markSeen,
    clearChecked: selection.clearChecked,
    closeProposal: panels.closeProposal,
    onResolved,
  }
}
