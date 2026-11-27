import { computed, type ComputedRef } from 'vue'

import { useAutoCheck } from '@/composables/useAutoCheck'
import { allOf, type BulkCount } from '@/format/bulkCount'
import { OPEN_SKIP_REASON, queueRoomReason, selectionCheckReason } from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'
import { useHandoffSelectionStore } from '@/stores/handoffSelectionStore'
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
 * Queues Auto-checks for the checked rows of the active list, read from the selection store the
 * hand-off uses. Rows with an open check are left out before the request; the server skips
 * private images and names them in the toast. A selection with more checks than the queue has
 * room for is blocked as a whole, the room counted from the open checks of the checks store.
 * @param {() => readonly number[]} source - Finding ids to check instead of the checked rows
 * @returns {SelectionAutoCheck} - Whether rows are checked, block reason and run
 */
export const useSelectionAutoCheck = (source?: () => readonly number[]): SelectionAutoCheck => {
  const checks = useChecksStore()
  const selection = useHandoffSelectionStore()
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

    return candidates.value.length < selected
      ? { affected: candidates.value.length, selected, skipped: [OPEN_SKIP_REASON] }
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
