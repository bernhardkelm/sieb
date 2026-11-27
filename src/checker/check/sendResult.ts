import { setTimeout as sleep } from 'node:timers/promises'

import type { WorkerResult } from '#core/check.ts'
import { errorMessage } from '#core/errorMessage.ts'
import { WorkerApiError, type WorkerApi } from '#checker/api/workerApi.ts'

const RESULT_ATTEMPTS = 3
const RESULT_RETRY_MS = 2000

/** What sending a result needs */
export interface SendDeps {
  api: WorkerApi
  log: (line: string) => void
  resultRetryMs?: number
}

/**
 * Returns whether a failed result request is worth repeating: network errors, timeouts, rate
 * limits and server errors are, other client errors such as 400, 404 or 413 are final.
 * @param {unknown} error - Error of the request
 * @returns {boolean} - Whether to retry
 */
const isRetryable = (error: unknown): boolean =>
  !(error instanceof WorkerApiError) ||
  error.status >= 500 ||
  error.status === 408 ||
  error.status === 429

/**
 * Sends the result, retrying transient failures a few times.
 * @param {SendDeps} deps - API, log and retry delay
 * @param {number} checkId - Check id
 * @param {WorkerResult} result - Result body
 * @returns {Promise<void>}
 */
export const sendResult = async (
  deps: SendDeps,
  checkId: number,
  result: WorkerResult,
): Promise<void> => {
  for (let attempt = 1; attempt <= RESULT_ATTEMPTS; attempt++) {
    try {
      await deps.api.result(checkId, result)

      return
    } catch (error) {
      const retry = isRetryable(error) && attempt < RESULT_ATTEMPTS

      deps.log(
        `[sieb-checker] result of check ${checkId} failed (${attempt}): ${errorMessage(error)}` +
          (retry ? '' : ', giving up'),
      )
      if (!retry) {
        return
      }

      await sleep((deps.resultRetryMs ?? RESULT_RETRY_MS) * attempt)
    }
  }
}
