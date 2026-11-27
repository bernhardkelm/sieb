import { ref, type Ref } from 'vue'

import { checkCreateNotice, partialCreateTitle } from '@/format/checkResultText'
import { useChecksStore } from '@/stores/checksStore'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { notifyError, notifyNotice, notifySuccess } from '@/toast/toastManager'

export interface AutoCheck {
  /** Whether a create request is in flight */
  submitting: Readonly<Ref<boolean>>
  /** Queues checks and reports the queued and skipped findings in a toast */
  submit: (findingIds: number[]) => Promise<boolean>
}

const submitting = ref(false)

/**
 * Queues Auto-checks for findings: one submit at a time across the app, split into requests of
 * at most MAX_CHECK_FINDINGS by the store. A toast names the queue position or count and the
 * skipped findings with their reason; a failure stays as an error toast that names the checks
 * queued before it. Queueing marks the findings seen, as acting on them.
 * @returns {AutoCheck} - In-flight state and submit
 */
export const useAutoCheck = (): AutoCheck => {
  const checks = useChecksStore()
  const seen = useFindingSeenStore()

  /**
   * Queues checks for findings.
   * @param {number[]} findingIds - Finding ids
   * @returns {Promise<boolean>} - Whether at least one check was queued
   */
  const submit = async (findingIds: number[]): Promise<boolean> => {
    if (submitting.value || findingIds.length === 0) {
      return false
    }

    submitting.value = true
    seen.markSeen(findingIds)

    try {
      const result = await checks.create(findingIds)
      const { failure } = result

      if (failure !== null) {
        notifyError(
          result.queued.length > 0
            ? partialCreateTitle(result.queued.length, failure.count)
            : 'Could not queue the Auto-check',
          failure.error,
        )
        return result.queued.length > 0
      }

      const notice = checkCreateNotice(result)

      if (notice.none) {
        notifyNotice(notice.title, notice.description)
      } else {
        notifySuccess(notice.title, notice.description)
      }

      return !notice.none
    } finally {
      submitting.value = false
    }
  }

  return { submitting, submit }
}
