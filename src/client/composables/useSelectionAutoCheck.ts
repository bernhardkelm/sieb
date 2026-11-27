import { computed, type ComputedRef } from 'vue'

import type { FindingView } from '#core/findingView.ts'
import type { SelectionHandoffFinding } from '#core/selectionHandoff.ts'
import { useAutoCheck } from '@/composables/useAutoCheck'
import { allOf, type BulkCount } from '@/format/bulkCount'
import {
  COVERED_SKIP_REASON,
  OPEN_SKIP_REASON,
  queueRoomReason,
  selectionCheckReason,
} from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { notifyNotice } from '@/toast/toastManager'

export interface SelectionAutoCheck {
  /** Whether rows are checked, the Auto-check then acts on them instead of the panel finding */
  active: ComputedRef<boolean>
  /** Checked rows a run queues, those without an open check */
  count: ComputedRef<number>
  /** Checked rows a run queues out of the checked ones, rows with an open check skipped */
  bulkCount: ComputedRef<BulkCount>
  /** Why the checked rows cannot be checked now, null while all of them fit into the queue */
  blockedBy: ComputedRef<string | null>
  /** Queues checks of the checked rows without an open check, false while blocked */
  run: () => Promise<boolean>
  /** Runs, or names the block reason in a toast, for a key or a tap that has no tooltip */
  runOrExplain: () => Promise<boolean>
}

/**
 * Returns the open proposal that covers a checked row, read from the row when the list hands
 * over full findings, else from the findings store.
 * @param {SelectionHandoffFinding | undefined} row - Checked row
 * @param {FindingView | undefined} stored - The finding in the findings store
 * @returns {number | null} - Covering proposal, null without one
 */
const coveredBy = (
  row: SelectionHandoffFinding | undefined,
  stored: FindingView | undefined,
): number | null => {
  const value =
    row !== undefined && 'coveredByProposal' in row
      ? row.coveredByProposal
      : stored?.coveredByProposal

  return typeof value === 'number' ? value : null
}

/**
 * Queues Auto-checks for the checked rows of the active list, read from the selection store the
 * hand-off uses. Rows with an open check are left out before the request; the server skips
 * images it cannot pull and findings an open proposal covers and names them in the toast, which
 * offers Check anyway for covered ones. Covered rows count as skipped in the partial count. A selection with more checks than the queue has
 * room for is blocked as a whole, the room counted from the open checks of the checks store.
 * @param {() => readonly number[]} source - Finding ids to check instead of the checked rows
 * @returns {SelectionAutoCheck} - Whether rows are checked, block reason and run
 */
export const useSelectionAutoCheck = (source?: () => readonly number[]): SelectionAutoCheck => {
  const checks = useChecksStore()
  const selection = useSelectionStore()
  const findings = useFindingsStore()
  const { submitting, submit } = useAutoCheck()
  const findingIds = computed(() => (source ? source() : selection.findingIds))

  const candidates = computed(() => findingIds.value.filter((id) => checks.openFor(id) === null))
  const blockedBy = computed(
    () =>
      selectionCheckReason(
        { enabled: checks.enabled, workerOnline: checks.workerOnline },
        candidates.value.length,
      ) ?? queueRoomReason(checks.open.length, candidates.value.length),
  )
  const bulkCount = computed<BulkCount>(() => {
    const selected = findingIds.value.length
    const rows = new Map(selection.findings.map((finding) => [finding.id, finding]))
    const uncovered = candidates.value.filter(
      (id) => coveredBy(rows.get(id), findings.byId.get(id)) === null,
    )
    const skipped = [
      ...(candidates.value.length < selected ? [OPEN_SKIP_REASON] : []),
      ...(uncovered.length < candidates.value.length ? [COVERED_SKIP_REASON] : []),
    ]

    return uncovered.length < selected
      ? { affected: uncovered.length, selected, skipped }
      : allOf(selected)
  })

  /**
   * Queues the checks unless blocked or a request is in flight.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const run = async (): Promise<boolean> => {
    if (blockedBy.value !== null || submitting.value) {
      return false
    }

    return submit([...candidates.value])
  }

  /**
   * Queues the checks, or shows why they cannot be queued.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const runOrExplain = async (): Promise<boolean> => {
    if (blockedBy.value !== null && !submitting.value) {
      notifyNotice('No Auto-check queued', blockedBy.value)
      return false
    }

    return run()
  }

  return {
    active: computed(() => findingIds.value.length > 0),
    count: computed(() => candidates.value.length),
    bulkCount,
    blockedBy,
    run,
    runOrExplain,
  }
}
