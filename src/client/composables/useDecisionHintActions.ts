import type { Ref } from 'vue'

import type { DecisionView } from '#core/findingView.ts'
import type { DecisionEditing } from '@/composables/useDecisionEditing'
import { useHintActions } from '@/composables/useHintActions'
import type { HintAction } from '@/keyboard/hintActions'
import { findingIdOfRowKey } from '@/keyboard/rowKey'

export interface DecisionHintSources {
  currentKey: Ref<string | null>
  /** Decision of a row, the decision row itself or a governed finding below it */
  decisionOf: (key: string | null) => DecisionView | null
  editing: DecisionEditing
  /** Opens the first open finding a decision governs, as o does on a decision row */
  openFirst: (view: DecisionView) => boolean
  hasOpenFinding: (view: DecisionView) => boolean
  /** Activates a row, as o does on a finding row */
  select: (key: string) => void
  focusSearch: () => void
  refocus: () => Promise<void>
}

const NO_CURSOR = 'No decision under the cursor'

/**
 * Registers the decisions hint actions for the cursor decision: Open finding, Edit, Revoke and
 * Re-confirm run what o, e, Backspace and c run, Search focuses the search input as / does.
 * Each is blocked where its key does nothing: Edit and Revoke on a revoked decision,
 * Re-confirm on a decision that is not re-opened or while one is running.
 * @param {DecisionHintSources} sources - Cursor decision and the actions of the view
 * @returns {void}
 */
export const useDecisionHintActions = (sources: DecisionHintSources): void => {
  const { currentKey, decisionOf, editing } = sources

  /**
   * Builds an action on the cursor decision.
   * @param {(view: DecisionView) => void} act - Runs the action
   * @param {(view: DecisionView) => string | null} blocked - Reason the decision blocks it
   * @returns {HintAction} - Hint action
   */
  const onCurrent = (
    act: (view: DecisionView) => void,
    blocked: (view: DecisionView) => string | null,
  ): HintAction => ({
    run: () => {
      const view = decisionOf(currentKey.value)

      if (view !== null) {
        act(view)
      }
    },
    blockedBy: () => {
      const view = decisionOf(currentKey.value)

      return view === null ? NO_CURSOR : blocked(view)
    },
  })

  /**
   * Returns why a revoked decision blocks an action.
   * @param {DecisionView} view - Decision
   * @returns {string | null} - Reason, null while not revoked
   */
  const revoked = (view: DecisionView): string | null =>
    view.decision.revokedAt === null ? null : 'Decision is revoked'

  /**
   * Returns whether the cursor sits on a governed finding row rather than the decision row.
   * @returns {boolean} - True on a finding row
   */
  const onFindingRow = (): boolean => findingIdOfRowKey(currentKey.value) !== null

  useHintActions(
    {
      openFinding: onCurrent(
        (view) => {
          if (onFindingRow() && currentKey.value !== null) {
            sources.select(currentKey.value)
          } else {
            sources.openFirst(view)
          }
        },
        (view) => (onFindingRow() || sources.hasOpenFinding(view) ? null : 'No open finding'),
      ),
      edit: onCurrent(editing.edit, revoked),
      revoke: onCurrent(editing.askRevoke, revoked),
      reconfirm: onCurrent(
        (view) => {
          void editing.reconfirm(view)
        },
        (view) => {
          if (view.effective.state !== 'reopened') {
            return 'Only re-opened decisions need re-confirming'
          }

          return editing.reconfirming.value ? 'Re-confirming' : null
        },
      ),
      search: { run: sources.focusSearch },
    },
    sources.refocus,
  )
}
