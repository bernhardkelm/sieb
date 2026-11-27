import type { CheckView, ChecksResponse } from '#core/check.ts'

export const CHECKS_FAST_POLL_MS = 5 * 1000
export const CHECKS_SLOW_POLL_MS = 60 * 1000

/**
 * Returns whether a check still waits or runs.
 * @param {CheckView} check - Check
 * @returns {boolean} - True for queued and running checks
 */
export const isOpenCheck = (check: CheckView): boolean =>
  check.state === 'queued' || check.state === 'running'

/**
 * Returns the open checks, the running one first and then the queue in order.
 * @param {ChecksResponse | null} response - Checks answer, null before the first one
 * @returns {CheckView[]} - Running and queued checks
 */
export const openChecksOf = (response: ChecksResponse | null): CheckView[] =>
  response === null
    ? []
    : [...(response.running === null ? [] : [response.running]), ...response.queued]

/**
 * Maps every finding to its latest check: an open check wins, else the newest recent one.
 * @param {ChecksResponse | null} response - Checks answer, null before the first one
 * @returns {Map<number, CheckView>} - Latest check per finding id
 */
export const latestChecksByFinding = (response: ChecksResponse | null): Map<number, CheckView> => {
  const latest = new Map<number, CheckView>()

  for (const check of [...openChecksOf(response), ...(response?.recent ?? [])]) {
    if (!latest.has(check.findingId)) {
      latest.set(check.findingId, check)
    }
  }

  return latest
}

/**
 * Returns the check a list row shows: open or failed ones, finished ones stay on the panel.
 * @param {CheckView | undefined} check - Latest check of the finding
 * @returns {CheckView | null} - Check for the row chip, null for none
 */
export const rowCheckOf = (check: CheckView | undefined): CheckView | null =>
  check !== undefined && (isOpenCheck(check) || check.state === 'failed') ? check : null

/**
 * Returns whether a check offers Retry: it failed or was cancelled and is still the latest check
 * of its finding, so an older entry or one already queued again offers nothing.
 * @param {CheckView} check - Check
 * @param {CheckView | null} latest - Latest check of the same finding
 * @returns {boolean} - True when a retry would re-queue the finding
 */
export const isRetryableCheck = (check: CheckView, latest: CheckView | null): boolean =>
  (check.state === 'failed' || check.state === 'cancelled') && latest?.id === check.id

/**
 * Returns the pause before the next fetch: short while a check waits or runs or the Checks page
 * shows, long otherwise.
 * @param {ChecksResponse | null} response - Last checks answer
 * @param {boolean} pageShown - Whether the Checks page is mounted
 * @returns {number} - Pause in ms
 */
export const checksPollInterval = (response: ChecksResponse | null, pageShown: boolean): number =>
  pageShown || openChecksOf(response).length > 0 ? CHECKS_FAST_POLL_MS : CHECKS_SLOW_POLL_MS
