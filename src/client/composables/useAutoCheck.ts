import { ref, type Ref } from 'vue'
import { useRouter, type Router } from 'vue-router'

import type { CheckCreateResponse } from '#core/check.ts'
import { checkCreateNotice, coveringProposals, partialCreateTitle } from '@/format/checkResultText'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import {
  notifyError,
  notifyNotice,
  notifySuccess,
  notifyWithAction,
  type ToastActionChoice,
} from '@/toast/toastManager'

export interface AutoCheckOptions {
  /** Queues findings an open proposal already covers as related findings */
  force?: boolean
}

export interface AutoCheck {
  /** Whether a create request is in flight */
  submitting: Readonly<Ref<boolean>>
  /** Queues checks and reports the queued and skipped findings in a toast */
  submit: (findingIds: number[], options?: AutoCheckOptions) => Promise<boolean>
}

const submitting = ref(false)

/**
 * Returns the toast action for findings skipped as covered by a proposal: Check anyway when
 * nothing was queued, else a link to the first covering proposal.
 * @param {CheckCreateResponse} answer - Create answer
 * @param {boolean} none - Whether nothing was queued
 * @param {Router | undefined} router - Router for the proposal link
 * @param {(ids: number[]) => void} checkAnyway - Re-queues the covered findings with force
 * @returns {ToastActionChoice | null} - Action, null without covered findings
 */
const coveredAction = (
  answer: CheckCreateResponse,
  none: boolean,
  router: Router | undefined,
  checkAnyway: (ids: number[]) => void,
): ToastActionChoice | null => {
  const covered = answer.skipped.filter((entry) => entry.reason === 'covered_by_proposal')
  const [proposalId] = coveringProposals(covered)

  if (covered.length === 0) {
    return null
  }

  if (none || proposalId === undefined || router === undefined) {
    return {
      label: 'Check anyway',
      altText: 'Queue the findings a proposal already covers anyway',
      onClick: () => checkAnyway(covered.map((entry) => entry.findingId)),
    }
  }

  return {
    label: `Open proposal #${proposalId}`,
    altText: `Open proposal #${proposalId}`,
    onClick: () => {
      void router.push({
        name: ROUTE_NAMES.INBOX_PROPOSAL,
        params: { [PROPOSAL_PARAM]: String(proposalId) },
      })
    },
  }
}

/**
 * Queues Auto-checks for findings: one submit at a time across the app, split into requests of
 * at most MAX_CHECK_FINDINGS by the store. A toast names the queue position or count and the
 * skipped findings with their reason, findings an open proposal covers with Check anyway or a
 * link to the proposal; a failure stays as an error toast that names the checks queued before
 * it. Queueing marks the findings seen, as acting on them.
 * @returns {AutoCheck} - In-flight state and submit
 */
export const useAutoCheck = (): AutoCheck => {
  const checks = useChecksStore()
  const seen = useFindingSeenStore()
  const router = useRouter() as Router | undefined

  /**
   * Queues checks for findings.
   * @param {number[]} findingIds - Finding ids
   * @param {AutoCheckOptions} options - force queues covered findings anyway
   * @returns {Promise<boolean>} - Whether at least one check was queued
   */
  const submit = async (findingIds: number[], options: AutoCheckOptions = {}): Promise<boolean> => {
    if (submitting.value || findingIds.length === 0) {
      return false
    }

    submitting.value = true
    seen.markSeen(findingIds)

    try {
      const result = await checks.create(findingIds, options.force === true)
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
      const action = coveredAction(result, notice.none, router, (ids) => {
        void submit(ids, { force: true })
      })

      if (action !== null) {
        notifyWithAction(
          `auto-check-covered-${Date.now()}`,
          notice.title,
          notice.description ?? '',
          action,
        )
      } else if (notice.none) {
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
