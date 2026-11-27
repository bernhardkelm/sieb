import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type ComputedRef,
  type Ref,
} from 'vue'

import type { CheckView } from '#core/check.ts'
import { useChecksStore } from '@/stores/checksStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

export interface ChecksPage {
  /** Whether nothing runs, waits or finished recently */
  empty: ComputedRef<boolean>
  /** Running check waiting for the cancel confirmation, null while none is asked */
  confirmTarget: Ref<CheckView | null>
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
  const confirmTarget = shallowRef<CheckView | null>(null)
  const confirmOpen = ref(false)
  const cancelling = ref(false)
  let release: (() => void) | null = null

  const empty = computed(
    () => checks.open.length === 0 && (checks.response?.recent.length ?? 0) === 0,
  )

  const confirmText = computed(() => {
    const target = confirmTarget.value

    return target === null
      ? ''
      : `Claude stops investigating ${target.vulnId} on ${target.imageRef} and files nothing.`
  })

  /**
   * Cancels a check and reports the outcome.
   * @param {CheckView} check - Queued or running check
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const cancel = async (check: CheckView): Promise<void> => {
    if (cancelling.value) {
      return
    }

    cancelling.value = true

    try {
      await checks.cancel(check.id)
      notifySuccess('Check cancelled', check.vulnId)
    } catch (failure) {
      notifyError('Could not cancel the check', failure)
    } finally {
      cancelling.value = false
    }
  }

  /**
   * Cancels a queued check, or opens the confirmation for a running one.
   * @param {CheckView} check - Check
   * @returns {void}
   */
  const requestCancel = (check: CheckView): void => {
    if (check.state === 'running') {
      confirmTarget.value = check
      confirmOpen.value = true
      return
    }

    void cancel(check)
  }

  /**
   * Cancels the confirmed running check and closes the dialog.
   * @returns {Promise<void>} - Resolves when the request settled
   */
  const confirmCancel = async (): Promise<void> => {
    const target = confirmTarget.value

    if (target !== null) {
      await cancel(target)
    }

    confirmOpen.value = false
  }

  onMounted(() => {
    release = checks.showPage()
  })

  onBeforeUnmount(() => {
    release?.()
  })

  return {
    empty,
    confirmTarget,
    confirmOpen,
    confirmText,
    cancelling,
    requestCancel,
    confirmCancel,
  }
}
