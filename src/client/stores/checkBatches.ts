import type { CheckCreateResponse } from '#core/check.ts'
import { MAX_CHECK_FINDINGS } from '#core/checkLimits.ts'

export interface CheckBatchFailure {
  /** Findings of the failed request and of the requests not sent after it */
  count: number
  error: unknown
}

export interface CheckBatchResult extends CheckCreateResponse {
  /** First failed request, null when every request was answered */
  failure: CheckBatchFailure | null
}

/**
 * Queues checks in requests of at most MAX_CHECK_FINDINGS findings and merges the answers. The
 * first failed request stops the rest; the checks queued before it stay queued and are reported
 * next to the failure.
 * @param {(ids: number[]) => Promise<CheckCreateResponse>} create - Create request
 * @param {readonly number[]} findingIds - Finding ids
 * @returns {Promise<CheckBatchResult>} - Queued and skipped findings of the answered requests, the failure
 */
export const createInBatches = async (
  create: (ids: number[]) => Promise<CheckCreateResponse>,
  findingIds: readonly number[],
): Promise<CheckBatchResult> => {
  const result: CheckBatchResult = { queued: [], skipped: [], failure: null }

  for (let start = 0; start < findingIds.length; start += MAX_CHECK_FINDINGS) {
    try {
      const answer = await create(findingIds.slice(start, start + MAX_CHECK_FINDINGS))

      result.queued.push(...answer.queued)
      result.skipped.push(...answer.skipped)
    } catch (error) {
      result.failure = { count: findingIds.length - start, error }
      break
    }
  }

  return result
}
