import { computed, watch, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  findingFilterParams,
  readFindingFilters,
  sameFindingFilters,
} from '@/router/findingFilterQuery'
import { withQueryParams } from '@/router/queryParam'
import { emptyFilters, type FindingFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'

export interface FindingFilterQuery {
  /** Filters of the findings store, writing them replaces the query params */
  filters: WritableComputedRef<FindingFilters>
  reset: () => Promise<void>
}

/**
 * Keeps the finding filters of a list view in the query (`q`, `sev`, `exp`, `owner`, `kev`,
 * `new`, `resolved`), so reload and links keep them. The query is the source: every navigation
 * of the view reads it into the findings store, ignoring unknown values. A change updates the
 * store at once, so typing stays responsive, and replaces the history entry, keeping every other
 * param such as `finding` and `sort`.
 * @returns {FindingFilterQuery} - Filters and their reset
 */
export const useFindingFilterQuery = (): FindingFilterQuery => {
  const route = useRoute()
  const router = useRouter()
  const store = useFindingsStore()
  const view = route.name

  watch(
    () => route.query,
    (query) => {
      const next = readFindingFilters(query)

      if (route.name === view && !sameFindingFilters(next, store.filters)) {
        store.filters = next
      }
    },
    { immediate: true },
  )

  /**
   * Applies filters to the store and the query.
   * @param {FindingFilters} next - New filters
   * @returns {Promise<void>} - Resolves after navigation
   */
  const write = async (next: FindingFilters): Promise<void> => {
    store.filters = next
    await router.replace({ query: withQueryParams(route.query, findingFilterParams(next)) })
  }

  const filters = computed<FindingFilters>({
    get: () => store.filters,
    set: (next) => {
      void write(next)
    },
  })

  return { filters, reset: () => write(emptyFilters()) }
}
