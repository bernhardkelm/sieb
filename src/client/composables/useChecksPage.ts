import { computed, onBeforeUnmount, onMounted, type ComputedRef, type Ref } from 'vue'

import type { CheckView } from '#core/check.ts'
import { useConfirmAction } from '@/composables/useConfirmAction'
import { cancelConfirmText } from '@/format/checkText'
import { useChecksStore } from '@/stores/checksStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

export interface ChecksPage {
  /** Whether nothing runs, waits or finished recently */
  empty: ComputedRef<boolean>
  confirmOpen: Ref<boolean>
  /** Description of the cancel confirmation */
  confirmText: ComputedRef<string>
  /** Whether a cancel request is in flight */
  cancelling: Readonly<Ref<boolean>>
  /** Cancels a queued check at once and asks before a running one */
  requestCancel: (check: CheckView) => void
  /** Cancels the running check the dialog asked about */
  confirmCancel: () => Promise<void>
}

/**
 * Drives the Checks page: marks it as shown while mounted, so the checks poll every 5 seconds,
 * and cancels checks, a running one only after a confirmation, with a toast either way.
 * @returns {ChecksPage} - Empty state and the cancel flow
 */
export const useChecksPage = (): ChecksPage => {
  const checks = useChecksStore()
  let release: (() => void) | null = null

  const cancellation = useConfirmAction<CheckView>(async (check) => {
    try {
      await checks.cancel(check.id)
      notifySuccess('Check cancelled', check.vulnId)
    } catch (failure) {
      notifyError('Could not cancel the check', failure)
    }
  })

  const empty = computed(() => checks.open.length === 0 && checks.recent.length === 0)

  /**
   * Cancels a queued check, or opens the confirmation for a running one.
   * @param {CheckView} check - Check
   * @returns {void}
   */
  const requestCancel = (check: CheckView): void => {
    if (check.state === 'running') {
      cancellation.ask(check)
      return
    }

    void cancellation.run(check)
  }

  onMounted(() => {
    release = checks.showPage()
  })

  onBeforeUnmount(() => {
    release?.()
  })

  return {
    empty,
    confirmOpen: cancellation.open,
    confirmText: computed(() => cancelConfirmText(cancellation.target.value)),
    cancelling: cancellation.busy,
    requestCancel,
    confirmCancel: async () => {
      await cancellation.confirm()
    },
  }
}
