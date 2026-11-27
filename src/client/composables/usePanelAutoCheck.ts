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

  const blockedBy = computed(() => {
    const loaded = detail.detail

    if (loaded === null) {
      return NO_FINDING_REASON
    }

    return findingCheckReason({
      enabled: checks.enabled,
      workerOnline: checks.workerOnline,
      sourceAccess: loaded.sourceAccess,
      resolved: loaded.finding.resolvedAt !== null,
      open: checks.openFor(loaded.finding.id),
    })
  })

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

  return { blockedBy, submitting: computed(() => submitting.value), run, runOrExplain }
}
