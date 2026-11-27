import { capText, MAX_CHECK_ERROR_LENGTH } from '#core/checkLimits.ts'
import { CheckFailure } from '#checker/CheckFailure.ts'
import { errorMessage } from '#checker/safeText.ts'

/** Abort reason when sieb answers a heartbeat with 409 or 404 */
export const CANCELLED_REASON = 'cancelled or timed out in sieb'

/** Abort reason when the worker receives SIGTERM or SIGINT */
export const STOPPED_REASON = 'worker stopped'

/**
 * Returns the short error text of a failed check.
 * @param {unknown} error - Error the check ended with
 * @param {AbortSignal} signal - Abort signal of the check, its reason wins once it fired
 * @returns {string} - Error text of at most MAX_CHECK_ERROR_LENGTH code points
 */
export const failureReason = (error: unknown, signal: AbortSignal): string => {
  if (signal.aborted) {
    return typeof signal.reason === 'string' ? signal.reason : 'aborted'
  }

  if (error instanceof CheckFailure) {
    return capText(error.message, MAX_CHECK_ERROR_LENGTH)
  }

  return capText(`internal error: ${errorMessage(error)}`, MAX_CHECK_ERROR_LENGTH)
}
