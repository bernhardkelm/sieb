import type { BulkDecisionResult } from '#core/decisionApiTypes.ts'
import { createBulkDecisions } from '@/api/decisionsApi'
import { bulkSkipSummary } from '@/components/decision/bulkSkipSummary'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import type { DecisionFormValue } from '@/components/decision/decisionFormModel'
import { bulkDecisionRequest } from '@/components/decision/decisionRequests'
import { useDecisionSettle } from '@/composables/useDecisionSettle'
import { countOf } from '@/format/count'
import { STATUS_LABELS } from '@/format/labels'
import { notifySuccess } from '@/toast/toastManager'
import { rethrowWithNotice } from '@/toast/validationNotice'

/**
 * Creates image-scoped decisions for several CVEs, one request per CVE. The decisions created
 * before a failure are applied and their findings marked seen all the same.
 * @returns {(targets: BulkTarget[], value: DecisionFormValue) => Promise<BulkDecisionResult>} - Bulk decide command
 */
export const useBulkDecide = (): ((
  targets: BulkTarget[],
  value: DecisionFormValue,
) => Promise<BulkDecisionResult>) => {
  const { settle, markDecidedSeen } = useDecisionSettle()

  /**
   * Creates image-scoped decisions for several CVEs, one request per CVE.
   * @param {BulkTarget[]} targets - CVEs with their images
   * @param {DecisionFormValue} value - Form values, scope ignored
   * @returns {Promise<BulkDecisionResult>} - Created decisions and skipped images of all CVEs
   */
  const bulkDecide = async (
    targets: BulkTarget[],
    value: DecisionFormValue,
  ): Promise<BulkDecisionResult> => {
    const total: BulkDecisionResult = { created: [], skipped: [] }

    try {
      for (const target of targets) {
        const result = await createBulkDecisions(bulkDecisionRequest(target, value))

        total.created.push(...result.created)
        total.skipped.push(...result.skipped)
      }
    } catch (error) {
      if (total.created.length > 0) {
        settle(total.created)
        markDecidedSeen(total.created)
      }

      return rethrowWithNotice('Bulk decision incomplete', error)
    }

    settle(total.created)
    markDecidedSeen(total.created)
    notifySuccess(
      `${STATUS_LABELS[value.status]}: ${countOf(total.created.length, 'decision')}`,
      bulkSkipSummary(total.skipped),
    )
    return total
  }

  return bulkDecide
}
