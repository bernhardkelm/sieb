import { ref } from 'vue'

import { emptyInboxFilters, type InboxFilters } from '@/components/inbox/inboxFilters'
import { useQueryFilters, type QueryFilters } from '@/composables/useQueryFilters'
import { inboxFilterParams, readInboxFilters, sameInboxFilters } from '@/router/inboxFilterQuery'
import { ROUTE_NAMES } from '@/router/routeNames'

export type InboxFilterQuery = QueryFilters<InboxFilters>

const INBOX_ROUTES: readonly unknown[] = [ROUTE_NAMES.INBOX, ROUTE_NAMES.INBOX_PROPOSAL]

/**
 * Keeps the Inbox filters in the query (`q`, `kind`, `sev`, `exp`, `owner`, `kev`), as Triage
 * does with its filters, so reload and links keep them and leaving the Inbox drops them. The
 * query is the source while the Inbox or its review panel shows; a change keeps every other
 * param and the open review.
 * @returns {InboxFilterQuery} - Filters and their reset
 */
export const useInboxFilterQuery = (): InboxFilterQuery => {
  const state = ref<InboxFilters>(emptyInboxFilters())

  return useQueryFilters({
    current: () => state.value,
    apply: (filters) => {
      state.value = filters
    },
    read: readInboxFilters,
    params: inboxFilterParams,
    same: sameInboxFilters,
    empty: emptyInboxFilters,
    reads: (routeName) => INBOX_ROUTES.includes(routeName),
  })
}
