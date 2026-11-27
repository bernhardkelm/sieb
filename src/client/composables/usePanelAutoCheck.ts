import { computed, type ComputedRef } from 'vue'

import { useAutoCheck } from '@/composables/useAutoCheck'
import { findingCheckReason } from '@/format/checkBlockReason'
import { NO_FINDING_REASON } from '@/format/handoffReasons'
import { useChecksStore } from '@/stores/checksStore'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { notifyNotice } from '@/toast/toastManager'

export interface PanelAutoCheck {
  /** Why the panel finding cannot be checked now, null while it can */
  blockedBy: ComputedRef<string | null>
  /** Whether the create request is in flight */
  submitting: ComputedRef<boolean>
  /** Queues a check of the panel finding, false while blocked */
  run: () => Promise<boolean>
  /** Runs, or names the block reason in a toast, for the key that has no button to show it */
  runOrExplain: () => Promise<boolean>
  /** Whether only an open proposal covering the finding blocks the check, which force overrides */
  canCheckAnyway: ComputedRef<boolean>
  /** Queues the check even though an open proposal covers the finding */
  runAnyway: () => Promise<boolean>
}

/**
 * Queues an Auto-check of the finding in the side panel for the button, the Shift+C key and the
 * sidebar hint, blocked while the feature is off, the worker offline, the image not public, the
 * finding resolved or already checked.
 * @returns {PanelAutoCheck} - Block reason, in-flight state and run
 */
export const usePanelAutoCheck = (): PanelAutoCheck => {
  const detail = useFindingDetailStore()
  const checks = useChecksStore()
  const { submitting, submit } = useAutoCheck()

  /**
   * Returns why the panel finding cannot be checked.
   * @param {boolean} counted - Whether a covering open proposal blocks the check
   * @returns {string | null} - Reason, null while a check can be queued
   */
  const reasonOf = (counted: boolean): string | null => {
    const loaded = detail.detail

    if (loaded === null) {
      return NO_FINDING_REASON
    }

    return findingCheckReason({
      enabled: checks.enabled,
      workerOnline: checks.workerOnline,
      visibility: loaded.imageVisibility,
      ownership: loaded.ownership,
      resolved: loaded.finding.resolvedAt !== null,
      open: checks.openFor(loaded.finding.id),
      checkAccess: loaded.checkAccess,
      coveredByProposal: counted ? loaded.finding.coveredByProposal : null,
    })
  }

  const blockedBy = computed(() => reasonOf(true))
  const canCheckAnyway = computed(() => blockedBy.value !== null && reasonOf(false) === null)

  /**
   * Queues a check of the panel finding unless blocked or a request is in flight.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const run = async (): Promise<boolean> => {
    const id = detail.detail?.finding.id

    if (id === undefined || blockedBy.value !== null) {
      return false
    }

    return submit([id])
  }

  /**
   * Queues a check, or shows why it cannot be queued.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const runOrExplain = async (): Promise<boolean> => {
    if (blockedBy.value !== null && !submitting.value) {
      notifyNotice('No Auto-check queued', blockedBy.value)
      return false
    }

    return run()
  }

  /**
   * Queues a check of the panel finding although an open proposal covers it.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const runAnyway = async (): Promise<boolean> => {
    const id = detail.detail?.finding.id

    if (id === undefined || !canCheckAnyway.value) {
      return false
    }

    return submit([id], { force: true })
  }

  return {
    blockedBy,
    submitting: computed(() => submitting.value),
    run,
    runOrExplain,
    canCheckAnyway,
    runAnyway,
  }
}
