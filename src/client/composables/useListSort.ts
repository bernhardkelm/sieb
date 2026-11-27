import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { SortColumns, SortState } from '@/components/list/listSort'
import { describeSort, nextSort, parseSort } from '@/components/list/sortState'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useQueryParam } from '@/composables/useQueryParam'
import { withQueryParams } from '@/router/queryParam'
import { SORT_DIRECTION_QUERY, SORT_QUERY } from '@/router/routeNames'

export interface ListSort<C extends string> {
  sort: ComputedRef<SortState<C> | null>
  /** Active sort for the list summary, such as "Severity, descending" */
  label: ComputedRef<string | null>
  set: (sort: SortState<C> | null) => Promise<void>
  toggle: (column: C) => Promise<void>
}

/**
 * Keeps the sort of a list view in the `sort` and `dir` query params, so reload and links keep
 * it; unknown values and a column hidden for lack of labels fall back to the default order.
 * Changes replace the history entry.
 * @param {SortColumns<T, C>} columns - Sortable columns of the view
 * @returns {ListSort<C>} - Active sort and its setters
 */
export const useListSort = <T, C extends string>(columns: SortColumns<T, C>): ListSort<C> => {
  const route = useRoute()
  const router = useRouter()
  const column = useQueryParam(SORT_QUERY)
  const direction = useQueryParam(SORT_DIRECTION_QUERY)

  const { hidden } = useLabelColumns()

  const sort = computed(() => {
    const parsed = parseSort(columns, column.value.value, direction.value.value)

    return parsed && (hidden.value as readonly string[]).includes(parsed.column) ? null : parsed
  })
  const label = computed(() => describeSort(columns, sort.value))

  /**
   * Sets the sort, null returns to the default order.
   * @param {SortState<C> | null} next - Next sort
   * @returns {Promise<void>} - Resolves after navigation
   */
  const set = async (next: SortState<C> | null): Promise<void> => {
    await router.replace({
      query: withQueryParams(route.query, {
        [SORT_QUERY]: next?.column ?? null,
        [SORT_DIRECTION_QUERY]: next?.direction ?? null,
      }),
    })
  }

  /**
   * Advances the sort of a column as a header click does.
   * @param {C} id - Clicked column
   * @returns {Promise<void>} - Resolves after navigation
   */
  const toggle = (id: C): Promise<void> => set(nextSort(sort.value, id, columns[id].first))

  return { sort, label, set, toggle }
}
