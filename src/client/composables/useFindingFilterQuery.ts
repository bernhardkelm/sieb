import { useRoute } from 'vue-router'

import { useQueryFilters, type QueryFilters } from '@/composables/useQueryFilters'
import {
  findingFilterParams,
  readFindingFilters,
  sameFindingFilters,
} from '@/router/findingFilterQuery'
import { emptyFilters, type FindingFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'

export type FindingFilterQuery = QueryFilters<FindingFilters>

/**
 * Keeps the finding filters of a list view in the query (`q`, `sev`, `exp`, `owner`, `kev`,
 * `new`, `resolved`, `pending`, `upstream`), so reload and links keep them. Every navigation of
 * the view reads the query into the findings store, ignoring unknown values; a change keeps every
 * other param such as `finding` and `sort`.
 * @returns {FindingFilterQuery} - Filters and their reset
 */
export const useFindingFilterQuery = (): FindingFilterQuery => {
  const store = useFindingsStore()
  const view = useRoute().name

  return useQueryFilters({
    current: () => store.filters,
    apply: (filters) => {
      store.filters = filters
    },
    read: readFindingFilters,
    params: findingFilterParams,
    same: sameFindingFilters,
    empty: emptyFilters,
    reads: (routeName) => routeName === view,
  })
}
