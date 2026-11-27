import type { Ref } from 'vue'

import type { CheckView } from '#core/check.ts'
import { isOpenCheck, rowCheckOf } from '@/components/checks/checkLookup'

export interface CheckLookups {
  /** Returns the latest check of a finding, an open one first, null without one */
  latestFor: (findingId: number) => CheckView | null
  /** Returns the queued or running check of a finding, null without one */
  openFor: (findingId: number) => CheckView | null
  /** Returns the check a list row shows, an open or failed one, null without one */
  rowCheckFor: (findingId: number) => CheckView | null
}

/**
 * Looks up the checks of a finding in the latest check per finding.
 * @param {Readonly<Ref<ReadonlyMap<number, CheckView>>>} latest - Latest check per finding id
 * @returns {CheckLookups} - Lookups by finding id
 */
export const createCheckLookups = (
  latest: Readonly<Ref<ReadonlyMap<number, CheckView>>>,
): CheckLookups => {
  /**
   * Returns the latest check of a finding, an open one first.
   * @param {number} findingId - Finding id
   * @returns {CheckView | null} - Check, null without one
   */
  const latestFor = (findingId: number): CheckView | null => latest.value.get(findingId) ?? null

  /**
   * Returns the queued or running check of a finding.
   * @param {number} findingId - Finding id
   * @returns {CheckView | null} - Open check, null without one
   */
  const openFor = (findingId: number): CheckView | null => {
    const check = latestFor(findingId)

    return check !== null && isOpenCheck(check) ? check : null
  }

  /**
   * Returns the check a list row shows, an open or failed one.
   * @param {number} findingId - Finding id
   * @returns {CheckView | null} - Check, null without one
   */
  const rowCheckFor = (findingId: number): CheckView | null =>
    rowCheckOf(latest.value.get(findingId))

  return { latestFor, openFor, rowCheckFor }
}
