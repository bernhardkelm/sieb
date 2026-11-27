import { computed, type ComputedRef } from 'vue'

import type { CheckView } from '#core/check.ts'
import { isRetryableCheck } from '@/components/checks/checkLookup'
import { useAutoCheck } from '@/composables/useAutoCheck'
import { availabilityReason } from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'

export interface CheckRetry {
  /** Whether the check failed or was cancelled and is the latest of its finding */
  available: ComputedRef<boolean>
  /** Why no retry can be queued right now, null while it can */
  blockedBy: ComputedRef<string | null>
  /** Whether a create request is in flight */
  submitting: ComputedRef<boolean>
  /** Queues the finding again, false while blocked */
  retry: () => Promise<boolean>
}

/**
 * Re-queues the finding of a failed or cancelled check through POST /api/checks, with the skip
 * reasons and toasts of every Auto-check, blocked while the feature is off or the worker offline.
 * @param {() => CheckView} check - Getter of the check the action belongs to
 * @returns {CheckRetry} - Availability, block reason, in-flight state and retry
 */
export const useCheckRetry = (check: () => CheckView): CheckRetry => {
  const checks = useChecksStore()
  const { submitting, submit } = useAutoCheck()

  const available = computed(() => isRetryableCheck(check(), checks.latestFor(check().findingId)))
  const blockedBy = computed(() =>
    availabilityReason({ enabled: checks.enabled, workerOnline: checks.workerOnline }),
  )

  /**
   * Queues the finding again unless blocked or a request is in flight.
   * @returns {Promise<boolean>} - Whether a check was queued
   */
  const retry = async (): Promise<boolean> => {
    if (!available.value || blockedBy.value !== null) {
      return false
    }

    return submit([check().findingId])
  }

  return { available, blockedBy, submitting: computed(() => submitting.value), retry }
}
