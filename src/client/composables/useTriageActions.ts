import { ref, type Ref } from 'vue'

import type { DecisionStatus } from '#core/decision.ts'
import type { FindingView } from '#core/findingView.ts'
import { bulkTargetsFor, type BulkTarget } from '@/components/decision/bulkTargets'
import { useFindingPanel } from '@/composables/useFindingPanel'
import type { ListSelection } from '@/composables/useListSelection'
import { DECISION_KEYMAP, type DecisionAction } from '@/keyboard/decisionKeymap'
import type { TriageAction } from '@/keyboard/triageKeymap'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

export interface TriageActionSources {
  findings: Readonly<Ref<readonly FindingView[]>>
  /** Cursor row and checked rows, read when an action runs */
  cursor: () => { currentKey: Ref<number | null>; selection: ListSelection<number> }
  focusSearch: () => void
}

export interface TriageActions {
  bulkOpen: Ref<boolean>
  bulkTargets: Ref<BulkTarget[]>
  bulkStatus: Ref<DecisionStatus | null>
  run: (action: TriageAction) => void
}

/**
 * Runs the triage key actions and holds the bulk dialog they open. A decision key decides the
 * checked rows in the bulk dialog, without checked rows it opens the decision form of the cursor
 * row in the panel, once the panel shows that row, so a navigation an unsaved draft kept leaves no
 * request behind.
 * @param {TriageActionSources} sources - Listed findings, cursor and search focus
 * @returns {TriageActions} - Bulk dialog state and the action runner
 */
export const useTriageActions = ({
  findings,
  cursor,
  focusSearch,
}: TriageActionSources): TriageActions => {
  const detail = useFindingDetailStore()
  const { findingId, openFinding, closeFinding } = useFindingPanel()
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
   * Decides the checked rows in the bulk dialog, or opens the decision form of the cursor row.
   * @param {number | null} id - Cursor row
   * @param {DecisionStatus} status - Status of the decision key
   * @returns {void}
   */
  const decide = (id: number | null, status: DecisionStatus): void => {
    const checked = bulkTargetsFor(findings.value, cursor().selection.checkedIds.value, null)

    if (checked.length > 0) {
      showBulk(checked, status)
    } else if (id !== null) {
      void openFinding(String(id)).then((opened) => {
        if (opened) {
          detail.requestDecision(id, status)
        }
      })
    }
  }

  const decisions = Object.fromEntries(
    DECISION_KEYMAP.map(({ action, status }) => [
      action,
      (id: number | null) => decide(id, status),
    ]),
  ) as Record<DecisionAction, (id: number | null) => void>

  const ACTIONS: Record<TriageAction, (id: number | null) => void> = {
    open: (id) => {
      if (id !== null) {
        void openFinding(String(id))
      }
    },
    close: () => {
      if (findingId.value !== null) {
        void closeFinding()
      }
    },
    bulk: (id) => {
      showBulk(bulkTargetsFor(findings.value, cursor().selection.checkedIds.value, id), null)
    },
    search: () => {
      focusSearch()
    },
    ...decisions,
  }

  return {
    bulkOpen,
    bulkTargets,
    bulkStatus,
    run: (action) => {
      ACTIONS[action](cursor().currentKey.value)
    },
  }
}
