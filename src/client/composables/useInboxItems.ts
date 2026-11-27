import { computed, type ComputedRef, type WritableComputedRef } from 'vue'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import {
  filterInboxItems,
  withoutHiddenInboxColumns,
  type InboxFilters,
} from '@/components/inbox/inboxFilters'
import { findingIdOfItem } from '@/components/inbox/inboxItems'
import { useInboxFilterQuery } from '@/composables/useInboxFilterQuery'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useInboxStore } from '@/stores/inboxStore'

export interface InboxListedItems {
  /** Filter bar state, kept in the query */
  filters: WritableComputedRef<InboxFilters>
  resetFilters: () => Promise<void>
  /** Items passing the filters, what the list, the cursor and the bulk actions work on */
  items: ComputedRef<InboxItem[]>
  keys: ComputedRef<string[]>
  byKey: ComputedRef<ReadonlyMap<string, InboxItem>>
  /** Finding a listed item opens in the side panel, null for none */
  findingIdOf: (key: string) => number | null
  /** Key of the listed item that opens a finding, empty when none does */
  keyOfFinding: (id: number) => string
  /** Rendered row of an item, null while not rendered */
  rowOf: (key: string) => HTMLElement | null
}

/**
 * Lists the Inbox items that pass the filters of the query, filters on hidden label columns
 * ignored, in list order and by key, with the lookups the list cursor needs.
 * @returns {InboxListedItems} - Filters and the listed items
 */
export const useInboxItems = (): InboxListedItems => {
  const store = useInboxStore()
  const filterQuery = useInboxFilterQuery()
  const { hidden } = useLabelColumns()

  const items = computed(() =>
    filterInboxItems(
      store.items,
      withoutHiddenInboxColumns(filterQuery.filters.value, hidden.value),
    ),
  )

  const byKey = computed(() => new Map(items.value.map((item) => [item.key, item])))

  /**
   * Returns the finding a listed item opens in the side panel.
   * @param {string} key - Item key
   * @returns {number | null} - Finding id, null for unlisted items and items without a finding
   */
  const findingIdOf = (key: string): number | null => {
    const item = byKey.value.get(key)

    return item ? findingIdOfItem(item) : null
  }

  return {
    filters: filterQuery.filters,
    resetFilters: filterQuery.reset,
    items,
    keys: computed(() => items.value.map((item) => item.key)),
    byKey,
    findingIdOf,
    keyOfFinding: (id) => items.value.find((item) => findingIdOfItem(item) === id)?.key ?? '',
    rowOf: (key) => document.querySelector<HTMLElement>(`[data-inbox-key="${CSS.escape(key)}"]`),
  }
}
