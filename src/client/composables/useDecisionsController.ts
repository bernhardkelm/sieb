import { onMounted, type ComputedRef, type Ref } from 'vue'

import type { DecisionFilter } from '#core/decisionFilter.ts'
import type { DecisionView, FindingView } from '#core/findingView.ts'
import type { DecisionSortColumn } from '@/components/decisions/decisionSort'
import { governedFindings } from '@/components/decisions/governedFindings'
import { useCursorList } from '@/composables/useCursorList'
import { useDecisionEditing, type DecisionEditing } from '@/composables/useDecisionEditing'
import { useDecisionHintActions } from '@/composables/useDecisionHintActions'
import { useDecisionRows } from '@/composables/useDecisionRows'
import { useFindingPanel } from '@/composables/useFindingPanel'
import type { ListSort } from '@/composables/useListSort'
import { isControlTarget } from '@/keyboard/keyboardTarget'
import { findingIdOfRowKey, groupOfRowKey } from '@/keyboard/rowKey'
import { useDecisionsStore } from '@/stores/decisionsStore'
import { useFindingsStore } from '@/stores/findingsStore'

export interface DecisionsController extends DecisionEditing {
  q: Ref<string>
  tab: Ref<DecisionFilter>
  counts: ComputedRef<Record<DecisionFilter, number>>
  decisions: ComputedRef<DecisionView[]>
  sort: ListSort<DecisionSortColumn>
  resetSort: () => Promise<void>
  expandedId: ComputedRef<number | null>
  expandedFindings: ComputedRef<FindingView[]>
  currentKey: Ref<string | null>
  select: (key: string) => void
  openFirstFinding: (view: DecisionView) => void
}

/**
 * Drives the decisions view on the rows of useDecisionRows: the keyboard cursor, e to edit,
 * Backspace or Delete to revoke, c to re-confirm and o to open the governed finding. These keys act on the cursor row, so they stay with a focused button, link or tab.
 * @param {() => void} focusSearch - Focuses the search input
 * @returns {DecisionsController} - State and actions for the view
 */
export const useDecisionsController = (focusSearch: () => void): DecisionsController => {
  const store = useDecisionsStore()
  const findings = useFindingsStore()
  const { openFinding } = useFindingPanel()
  const rows = useDecisionRows()
  const editing = useDecisionEditing()
  const { decisions, sort, expanded, expandedId, keys } = rows

  /**
   * Returns the decision of a row, the decision row itself or a governed finding below it.
   * @param {string | null} key - Row key
   * @returns {DecisionView | null} - Decision, null without a row
   */
  const decisionOf = (key: string | null): DecisionView | null => {
    const id = findingIdOfRowKey(key) === null ? Number(groupOfRowKey(key)) : expandedId.value

    return decisions.value.find((view) => view.decision.id === id) ?? null
  }

  /**
   * Opens the first open finding a decision governs in the side panel.
   * @param {DecisionView} view - Decision
   * @returns {boolean} - Whether a finding was opened
   */
  const openFirst = (view: DecisionView): boolean => {
    const [first] = governedFindings(view.decision, findings.items)

    if (first) {
      void openFinding(String(first.id))
    }

    return first !== undefined
  }

  const cursor = useCursorList({
    keys,
    activateGroup: expanded.toggle,
    close: () => expanded.collapse(cursor.focusKey),
    expanded: () => expanded.value.value,
    focusSearch,
    paused: () => editing.editOpen.value || editing.revokeOpen.value,
    viewKey: (event, scope, currentKey) => {
      const view = decisionOf(currentKey)

      if (view === null || scope !== 'page' || isControlTarget(event.target)) {
        return false
      }

      switch (event.key) {
        case 'e':
          editing.edit(view)
          return true
        case 'c':
          void editing.reconfirm(view)
          return view.effective.state === 'reopened'
        case 'Backspace':
        case 'Delete':
          editing.askRevoke(view)
          return true
        case 'o':
          return findingIdOfRowKey(currentKey) === null && openFirst(view)
      }

      return false
    },
  })

  expanded.placeCursor(keys, cursor)

  useDecisionHintActions({
    currentKey: cursor.currentKey,
    decisionOf,
    editing,
    openFirst,
    hasOpenFinding: (view) => governedFindings(view.decision, findings.items).length > 0,
    select: cursor.select,
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
    ...editing,
    q: rows.q,
    tab: rows.tab,
    counts: rows.counts,
    decisions,
    sort,
    resetSort,
    expandedId,
    expandedFindings: rows.expandedFindings,
    currentKey: cursor.currentKey,
    select: cursor.select,
    openFirstFinding: (view) => {
      openFirst(view)
    },
  }
}
