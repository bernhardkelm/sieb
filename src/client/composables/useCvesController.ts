import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { FindingView } from '#core/findingView.ts'
import { groupBy } from '#core/groupBy.ts'
import { filterCves } from '@/components/cves/cveFilters'
import { CVE_SORT_COLUMNS, sortCves, type CveSortColumn } from '@/components/cves/cveSort'
import { summarizeDecisions } from '@/components/cves/decisionSummary'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import { emptyAggregateFilters, type AggregateFilters } from '@/components/filters/aggregateFilters'
import { useCursorList } from '@/composables/useCursorList'
import { useExpandedGroup } from '@/composables/useExpandedGroup'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { findingIdOfRowKey, findingRowKey, groupOfRowKey, groupRowKey } from '@/keyboard/rowKey'
import { CVE_QUERY } from '@/router/routeNames'
import { useCvesStore } from '@/stores/cvesStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface CvesController {
  filters: Ref<AggregateFilters>
  cves: ComputedRef<CveAggregate[]>
  sort: ListSort<CveSortColumn>
  resetSort: () => Promise<void>
  expandedId: ComputedRef<string | null>
  expandedFindings: ComputedRef<FindingView[]>
  summaries: ComputedRef<Map<string, string>>
  currentKey: Ref<string | null>
  bulkOpen: Ref<boolean>
  bulkTargets: Ref<BulkTarget[]>
  decideOpen: Ref<boolean>
  decideCve: Ref<CveAggregate | null>
  select: (key: string) => void
  openBulk: (vulnId: string) => void
  openDecideAll: (vulnId: string) => void
}

/**
 * Drives the by-CVE view: filtered CVEs with their decision summary in the sort of the `sort` and
 * `dir` query params, the CVE expanded through
 * the `cve` query param with its open findings per image, the keyboard cursor, Shift+A to decide
 * every open image of the CVE and Shift+D to decide it for all images including future ones.
 * @param {() => void} focusSearch - Focuses the search input
 * @returns {CvesController} - State and actions for the view
 */
export const useCvesController = (focusSearch: () => void): CvesController => {
  const store = useCvesStore()
  const findings = useFindingsStore()
  const filters = ref(emptyAggregateFilters())
  const bulkOpen = ref(false)
  const bulkTargets = ref<BulkTarget[]>([])
  const decideOpen = ref(false)
  const decideCve = ref<CveAggregate | null>(null)

  const sort = useListSort(CVE_SORT_COLUMNS)

  const cves = computed(() => sortCves(filterCves(store.items, filters.value), sort.sort.value))
  const openByCve = computed(() =>
    groupBy(
      findings.items.filter((finding) => finding.resolvedAt === null),
      (finding) => finding.vulnId,
    ),
  )
  const summaries = computed(
    () =>
      new Map([...openByCve.value].map(([vulnId, group]) => [vulnId, summarizeDecisions(group)])),
  )
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

  /**
   * Opens the bulk dialog for every open image of a CVE.
   * @param {string} vulnId - Vuln id
   * @returns {void}
   */
  const openBulk = (vulnId: string): void => {
    bulkTargets.value = [{ vulnId, imageRefs: 'all-open' }]
    bulkOpen.value = true
  }

  /**
   * Opens the dialog deciding a CVE for all images, including images that show up later.
   * @param {string} vulnId - Vuln id
   * @returns {void}
   */
  const openDecideAll = (vulnId: string): void => {
    decideCve.value = store.items.find((cve) => cve.vulnId === vulnId) ?? null
    decideOpen.value = decideCve.value !== null
  }

  const cursor = useCursorList({
    keys,
    activateGroup: expanded.toggle,
    close: () => expanded.collapse(cursor.focusKey),
    focusSearch,
    paused: () => bulkOpen.value || decideOpen.value,
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
    sort,
    resetSort,
    expandedId: expanded.value,
    expandedFindings,
    summaries,
    currentKey: cursor.currentKey,
    bulkOpen,
    bulkTargets,
    decideOpen,
    decideCve,
    select: cursor.select,
    openBulk,
    openDecideAll,
  }
}
