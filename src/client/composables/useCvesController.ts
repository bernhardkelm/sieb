import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { FindingView } from '#core/findingView.ts'
import { countHiddenCves, filterCves } from '@/components/cves/cveFilters'
import { CVE_SORT_COLUMNS, sortCves, type CveSortColumn } from '@/components/cves/cveSort'
import {
  emptyAggregateFilters,
  withoutHiddenAggregateColumns,
  type AggregateFilters,
} from '@/components/filters/aggregateFilters'
import { useCursorList } from '@/composables/useCursorList'
import { useCveDecisionDialogs, type CveDecisionDialogs } from '@/composables/useCveDecisionDialogs'
import { useCveHintActions } from '@/composables/useCveHintActions'
import { useCveOpenFindings } from '@/composables/useCveOpenFindings'
import { useExpandedGroup } from '@/composables/useExpandedGroup'
import { useLabelColumns } from '@/composables/useLabelColumns'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { findingIdOfRowKey, findingRowKey, groupOfRowKey, groupRowKey } from '@/keyboard/rowKey'
import { CVE_QUERY } from '@/router/routeNames'
import { useCvesStore } from '@/stores/cvesStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface CvesController extends Omit<CveDecisionDialogs, 'anyOpen'> {
  filters: Ref<AggregateFilters>
  cves: ComputedRef<CveAggregate[]>
  hiddenCount: ComputedRef<number>
  sort: ListSort<CveSortColumn>
  resetSort: () => Promise<void>
  expandedId: ComputedRef<string | null>
  expandedFindings: ComputedRef<FindingView[]>
  summaries: ComputedRef<Map<string, string>>
  currentKey: Ref<string | null>
  select: (key: string) => void
}

/**
 * Drives the by-CVE view: filtered CVEs with their decision summary in the sort of the `sort` and
 * `dir` query params, fully decided CVEs hidden until the showDecided filter, the CVE expanded
 * through the `cve` query param with its open findings per image, the keyboard cursor, Shift+A to
 * decide every open image of the CVE and Shift+D to decide it for all images including future ones.
 * Filters on hidden label columns are ignored.
 * @param {() => void} focusSearch - Focuses the search input
 * @returns {CvesController} - State and actions for the view
 */
export const useCvesController = (focusSearch: () => void): CvesController => {
  const store = useCvesStore()
  const findings = useFindingsStore()
  const filters = ref(emptyAggregateFilters())
  const dialogs = useCveDecisionDialogs(() => store.items)
  const { openBulk, openDecideAll } = dialogs

  const { hidden } = useLabelColumns()
  const applied = computed(() => withoutHiddenAggregateColumns(filters.value, hidden.value))

  const sort = useListSort(CVE_SORT_COLUMNS)

  const cves = computed(() => sortCves(filterCves(store.items, applied.value), sort.sort.value))
  const hiddenCount = computed(() => countHiddenCves(store.items, applied.value))
  const { openByCve, summaries } = useCveOpenFindings()
  const expanded = useExpandedGroup(CVE_QUERY)
  const expandedFindings = computed(() =>
    expanded.value.value === null ? [] : (openByCve.value.get(expanded.value.value) ?? []),
  )
  const keys = computed(() =>
    cves.value.flatMap((cve) => [
      groupRowKey(cve.vulnId),
      ...(cve.vulnId === expanded.value.value
        ? expandedFindings.value.map((finding) => findingRowKey(finding.id))
        : []),
    ]),
  )

  /**
   * Returns the CVE of a row, the CVE row itself or a finding row below it.
   * @param {string | null} key - Row key
   * @returns {string | null} - Vuln id, null without a row
   */
  const vulnIdOf = (key: string | null): string | null => {
    const id = findingIdOfRowKey(key)

    return id === null
      ? groupOfRowKey(key)
      : (findings.items.find((finding) => finding.id === id)?.vulnId ?? null)
  }

  const cursor = useCursorList({
    keys,
    activateGroup: expanded.toggle,
    close: () => expanded.collapse(cursor.focusKey),
    expanded: () => expanded.value.value,
    focusSearch,
    paused: dialogs.anyOpen,
    viewKey: (event, _scope, currentKey) => {
      const vulnId = vulnIdOf(currentKey)

      if (!event.shiftKey || vulnId === null || (event.key !== 'A' && event.key !== 'D')) {
        return false
      }

      if (event.key === 'A') {
        openBulk(vulnId)
      } else {
        openDecideAll(vulnId)
      }

      return true
    },
  })

  expanded.placeCursor(keys, cursor)

  useCveHintActions({
    currentCve: () => {
      const vulnId = vulnIdOf(cursor.currentKey.value)

      return store.items.find((cve) => cve.vulnId === vulnId) ?? null
    },
    openBulk,
    openDecideAll,
    focusSearch,
    refocus: cursor.refocus,
  })

  /**
   * Returns to the default order and focuses the cursor row, as the reset button disappears.
   * @returns {Promise<void>} - Resolves once focused
   */
  const resetSort = async (): Promise<void> => {
    await sort.set(null)
    await cursor.refocus()
  }

  onMounted(() => {
    void store.ensureLoaded()
    void findings.ensureLoaded()
  })

  return {
    filters,
    cves,
    hiddenCount,
    sort,
    resetSort,
    expandedId: expanded.value,
    expandedFindings,
    summaries,
    currentKey: cursor.currentKey,
    bulkOpen: dialogs.bulkOpen,
    bulkTargets: dialogs.bulkTargets,
    decideOpen: dialogs.decideOpen,
    decideCve: dialogs.decideCve,
    select: cursor.select,
    openBulk,
    openDecideAll,
  }
}
