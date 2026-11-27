import { computed, watch, type WritableComputedRef } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

import { withQueryParams } from '@/router/queryParam'

export interface QueryFiltersOptions<F> {
  /** Filters the view shows now */
  current: () => F
  /** Stores filters as the current ones */
  apply: (filters: F) => void
  read: (query: LocationQuery) => F
  /** Query params of filters, null removes a param */
  params: (filters: F) => Record<string, string | null>
  same: (a: F, b: F) => boolean
  empty: () => F
  /** Whether the current route reads its filters from the query */
  reads: (routeName: unknown) => boolean
}

export interface QueryFilters<F> {
  /** Current filters, writing them replaces the query params */
  filters: WritableComputedRef<F>
  reset: () => Promise<void>
}

/**
 * Keeps the filters of a view in the query, so reload and links keep them. The query is the
 * source: every navigation of a reading route reads it into the current filters. A change applies
 * at once, so typing stays responsive, and replaces the history entry, keeping every other param.
 * @param {QueryFiltersOptions<F>} options - Filter state, query codec and the routes that read it
 * @returns {QueryFilters<F>} - Filters and their reset
 */
export const useQueryFilters = <F>(options: QueryFiltersOptions<F>): QueryFilters<F> => {
  const route = useRoute()
  const router = useRouter()

  watch(
    () => route.query,
    (query) => {
      const next = options.read(query)

      if (options.reads(route.name) && !options.same(next, options.current())) {
        options.apply(next)
      }
    },
    { immediate: true },
  )

  /**
   * Applies filters to the state and the query.
   * @param {F} next - New filters
   * @returns {Promise<void>} - Resolves after navigation
   */
  const write = async (next: F): Promise<void> => {
    options.apply(next)
    await router.replace({ query: withQueryParams(route.query, options.params(next)) })
  }

  const filters = computed<F>({
    get: options.current,
    set: (next) => {
      void write(next)
    },
  })

  return { filters, reset: () => write(options.empty()) }
}
