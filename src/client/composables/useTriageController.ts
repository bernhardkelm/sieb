import {
  computed,
  onMounted,
  onScopeDispose,
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
} from 'vue'

import type { FindingView } from '#core/findingView.ts'
import {
  TRIAGE_SORT_COLUMNS,
  sortTriage,
  type TriageSortColumn,
} from '@/components/triage/triageSort'
import { useCheckboxToggle } from '@/composables/useCheckboxToggle'
import { useFindingFilterQuery } from '@/composables/useFindingFilterQuery'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { useSelectionHandoffKeys } from '@/composables/useSelectionHandoffKeys'
import { useTriageActions, type TriageActions } from '@/composables/useTriageActions'
import { useTriageHintActions } from '@/composables/useTriageHintActions'
import { useTriageNew } from '@/composables/useTriageNew'
import { useListCursor } from '@/composables/useListCursor'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { triageActionFor } from '@/keyboard/triageKeymap'
import type { FindingFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'
import { useSelectionStore } from '@/stores/selectionStore'

export interface TriageController extends Pick<
  TriageActions,
  'bulkOpen' | 'bulkTargets' | 'bulkStatus'
> {
  /** Filter bar state, kept in the query */
  filters: WritableComputedRef<FindingFilters>
  resetFilters: () => Promise<void>
  findings: ComputedRef<FindingView[]>
  sort: ListSort<TriageSortColumn>
  resetSort: () => Promise<void>
  newCount: ComputedRef<number>
  markAllSeen: () => void
  currentId: Ref<number | null>
  checkedIds: Ref<Set<number>>
  select: (id: number, event?: MouseEvent) => void
  openBulk: () => void
  toggleChecked: (id: number, event?: MouseEvent) => void
  clearChecked: () => void
}

/**
 * Drives the triage list on the shared list cursor with multiple selection: cursor and checked
 * rows over the triage list filtered by the filter query params (see useFindingFilterQuery) in the
 * sort of the `sort` and `dir` query params, triage order by default, the triage keymap, the side
 * panel following the cursor and the bulk dialog, which a, n and f open for the checked rows
 * (see useTriageActions). A panel opened by link on a finding outside the list stays until a
 * cursor key moves the cursor.
 * @param {() => void} focusSearch - Focuses the search input of the filter bar
 * @returns {TriageController} - State and actions for the triage view
 */
export const useTriageController = (focusSearch: () => void): TriageController => {
  const store = useFindingsStore()
  const { openFinding } = useFindingPanel()
  const filterQuery = useFindingFilterQuery()

  const sort = useListSort(TRIAGE_SORT_COLUMNS)

  const findings = computed(() => sortTriage(store.inbox, sort.sort.value))
  const ids = computed(() => findings.value.map((finding) => finding.id))
  const { newCount, markAllSeen } = useTriageNew(findings)
  const handoffKey = useSelectionHandoffKeys()
  const { bulkOpen, bulkTargets, bulkStatus, run } = useTriageActions({
    findings,
    cursor: () => cursor,
    focusSearch,
  })

  /**
   * Returns the rendered row of a finding.
   * @param {number} id - Finding id
   * @returns {HTMLElement | null} - Row element, null while not rendered
   */
  const rowOf = (id: number): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[data-finding-id="${id}"]`)

  const cursor = useListCursor<number>({
    keys: ids,
    findingIdOf: (id) => id,
    keyOfFinding: (id) => id,
    rowOf,
    multiselect: true,
    paused: () => bulkOpen.value,
    handleKey: (event, scope) => {
      const action = triageActionFor(event, scope)

      if (action !== null) {
        run(action)
        return true
      }

      return handoffKey(event, scope)
    },
  })

  const toggleChecked = useCheckboxToggle(cursor, rowOf)

  useTriageHintActions({ run, cursor, ids })

  onScopeDispose(
    useSelectionStore().register(() =>
      findings.value.filter((finding) => cursor.selection.checkedIds.value.has(finding.id)),
    ),
  )

  /**
   * Handles a click on a row: Shift checks the range from the anchor, Cmd or Ctrl checks or
   * unchecks the row, a plain click puts the cursor on the row and opens it in the panel.
   * @param {number} id - Finding id
   * @param {MouseEvent | undefined} event - Click
   * @returns {void}
   */
  const select = (id: number, event?: MouseEvent): void => {
    if (cursor.click(id, event)) {
      return
    }

    cursor.currentKey.value = id
    void openFinding(String(id))
  }

  /**
   * Opens the bulk dialog for the checked rows, as shift+A does.
   * @returns {void}
   */
  const openBulk = (): void => {
    run('bulk')
  }

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
  })

  return {
    filters: filterQuery.filters,
    resetFilters: filterQuery.reset,
    findings,
    sort,
    resetSort,
    newCount,
    markAllSeen,
    currentId: cursor.currentKey,
    checkedIds: cursor.selection.checkedIds,
    bulkOpen,
    bulkTargets,
    bulkStatus,
    select,
    openBulk,
    toggleChecked,
    clearChecked: cursor.selection.clearChecked,
  }
}
