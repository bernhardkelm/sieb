import { watch } from 'vue'
import { useRouter } from 'vue-router'

import type { CheckView } from '#core/check.ts'
import { createCheckFinishTracker } from '@/components/checks/checkFinishes'
import { checkFinishNotice } from '@/format/checkFinishText'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'
import { useMeStore } from '@/stores/meStore'
import { notifyError, notifySuccess, notifyWithAction } from '@/toast/toastManager'

/**
 * Shows a toast whenever the checks poll sees an Auto-check of the acting user end: done with a
 * Review action that opens its proposal, done without a proposal, or failed with its reason.
 * Checks that ended before the first answer and cancelled checks stay silent. Call once, from
 * the app shell.
 * @returns {void}
 */
export const useCheckFinishToasts = (): void => {
  const checks = useChecksStore()
  const me = useMeStore()
  const router = useRouter()
  const tracker = createCheckFinishTracker()

  /**
   * Shows the toast of one ended check.
   * @param {CheckView} check - Done or failed check
   * @returns {void}
   */
  const announce = (check: CheckView): void => {
    const notice = checkFinishNotice(check)
    const { proposalId } = notice

    if (notice.failed) {
      notifyError(notice.title, notice.description)
    } else if (proposalId === null) {
      notifySuccess(notice.title, notice.description)
    } else {
      notifyWithAction(`check-finished-${check.id}`, notice.title, notice.description, {
        label: 'Review',
        altText: `Review proposal #${proposalId}`,
        onClick: () => {
          void router.push({
            name: ROUTE_NAMES.INBOX_PROPOSAL,
            params: { [PROPOSAL_PARAM]: proposalId },
          })
        },
      })
    }
  }

  watch(
    () => checks.response,
    (response) => {
      if (response !== null) {
        tracker.next(response, me.username).forEach(announce)
      }
    },
    { immediate: true },
  )
}
