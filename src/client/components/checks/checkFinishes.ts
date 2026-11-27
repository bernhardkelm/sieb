import type { CheckView, ChecksResponse } from '#core/check.ts'
import { openChecksOf } from '@/components/checks/checkLookup'

export interface CheckFinishTracker {
  /** Returns the checks of the user that left running for done or failed since the last answer */
  next: (response: ChecksResponse, me: string | null) => CheckView[]
}

/**
 * Tracks which checks were open in the previous checks answer, so each check that ends is
 * reported once. The first answer only records the open checks: checks that had already ended
 * when the page loaded are never reported, and cancelled checks never are either.
 * @returns {CheckFinishTracker} - Tracker
 */
export const createCheckFinishTracker = (): CheckFinishTracker => {
  let watched = new Set<number>()

  return {
    next: (response, me) => {
      const ended = response.recent.filter(
        (check) =>
          watched.has(check.id) &&
          (check.state === 'done' || check.state === 'failed') &&
          me !== null &&
          check.requestedBy === me,
      )

      watched = new Set(openChecksOf(response).map((check) => check.id))
      return ended
    },
  }
}
