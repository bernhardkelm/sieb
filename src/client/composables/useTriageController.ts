import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import type { FindingView } from '#core/findingView.ts'
import { bulkTargetsFor, type BulkTarget } from '@/components/decision/bulkTargets'
import {
  TRIAGE_SORT_COLUMNS,
  sortTriage,
  type TriageSortColumn,
} from '@/components/triage/triageSort'
import { useCursorRefocus } from '@/composables/useCursorRefocus'
import { useFindingPanel } from '@/composables/useFindingPanel'
import { useTriageHintActions } from '@/composables/useTriageHintActions'
import { useListCursor } from '@/composables/useListCursor'
import { useListSort, type ListSort } from '@/composables/useListSort'
import { useNow } from '@/composables/useNow'
import { triageActionFor, type TriageAction } from '@/keyboard/triageKeymap'
import { rowClickIntent } from '@/keyboard/rowClick'
import { isNewFinding } from '@/stores/findingFilters'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface TriageController {
  findings: ComputedRef<FindingView[]>
  sort: ListSort<TriageSortColumn>
  resetSort: () => Promise<void>
  newCount: ComputedRef<number>
  currentId: Ref<number | null>
  checkedIds: Ref<Set<number>>
  bulkOpen: Ref<boolean>
  bulkTargets: Ref<BulkTarget[]>
  bulkStatus: Ref<DecisionStatus | null>
  select: (id: number, event?: MouseEvent) => void
  openBulk: () => void
  toggleChecked: (id: number, event?: MouseEvent) => void
  clearChecked: () => void
}

const ACTION_STATUS: Partial<Record<TriageAction, DecisionStatus>> = {
  accept: 'accepted',
  notAffected: 'not_affected',
  fixPlanned: 'fix_planned',
}

/**
 * Drives the triage list on the shared list cursor with multiple selection: cursor and checked rows
 * over the filtered triage list in the sort of the `sort` and `dir` query params, triage order by
 * default, the triage keymap, the side panel following the cursor and the bulk dialog, which a,
 * n and f open for the checked rows. A panel
 * opened by link on a finding outside the list stays until a cursor key moves the cursor.
 * @param {() => void} focusSearch - Focuses the search input of the filter bar
 * @returns {TriageController} - State and actions for the triage view
 */
export const useTriageController = (focusSearch: () => void): TriageController => {
  const store = useFindingsStore()
  const detail = useFindingDetailStore()
  const { findingId, openFinding, closeFinding } = useFindingPanel()
  const now = useNow()

  const sort = useListSort(TRIAGE_SORT_COLUMNS)

  const findings = computed(() => sortTriage(store.inbox, sort.sort.value))
  const ids = computed(() => findings.value.map((finding) => finding.id))
  const newCount = computed(
    () => findings.value.filter((finding) => isNewFinding(finding.firstSeen, now.value)).length,
  )
  const bulkOpen = ref(false)
  const bulkTargets = ref<BulkTarget[]>([])
  const bulkStatus = ref<DecisionStatus | null>(null)

  /**
   * Opens the bulk dialog for targets, with a status preselected or none.
   * @param {BulkTarget[]} targets - Targets, the dialog stays closed when empty
   * @param {DecisionStatus | null} status - Preselected status, null for none
   * @returns {void}
   */
  const showBulk = (targets: BulkTarget[], status: DecisionStatus | null): void => {
    bulkTargets.value = targets
    bulkStatus.value = status
    bulkOpen.value = targets.length > 0
  }

  /**
   * Runs a triage action. A decision key decides the checked rows in the bulk dialog, without
   * checked rows it opens the decision form of the cursor row in the panel, once the panel
   * shows that row, so a navigation an unsaved draft kept leaves no request behind.
   * @param {TriageAction} action - Action
   * @returns {void}
   */
  const run = (action: TriageAction): void => {
    const { selection } = cursor
    const id = cursor.currentKey.value

    switch (action) {
      case 'open':
        if (id !== null) {
          void openFinding(String(id))
        }
        return
      case 'close':
        if (findingId.value !== null) {
          void closeFinding()
        }
        return
      case 'bulk':
        showBulk(bulkTargetsFor(findings.value, selection.checkedIds.value, id), null)
        return
      case 'search':
        focusSearch()
        return
      default: {
        const status = ACTION_STATUS[action]
        const checked = bulkTargetsFor(findings.value, selection.checkedIds.value, null)

        if (status && checked.length > 0) {
          showBulk(checked, status)
        } else if (id !== null && status) {
          void openFinding(String(id)).then((opened) => {
            if (opened) {
              detail.requestDecision(id, status)
            }
          })
        }
      }
    }
  }

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
      }

      return action !== null
    },
  })

  const refocusCursor = useCursorRefocus(cursor.currentKey, rowOf)

  useTriageHintActions({ run, cursor, ids })

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
   * Handles a click on the checkbox of a row: Shift checks the range from the anchor as a Shift
   * click on the row does, every other click checks or unchecks the row and anchors there,
   * leaving cursor and panel where they are and focus on the cursor row.
   * @param {number} id - Finding id
   * @param {MouseEvent | undefined} event - Click
   * @returns {void}
   */
  const toggleChecked = (id: number, event?: MouseEvent): void => {
    if (rowClickIntent(event, true) === 'range') {
      cursor.click(id, event)
    } else {
      cursor.selection.toggleChecked(id)
      refocusCursor()
    }
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
    findings,
    sort,
    resetSort,
    newCount,
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
