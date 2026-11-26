import { isExpiring } from '#core/decisionFilter.ts'
import type { FindingView } from '#core/findingView.ts'

/**
 * Counts the distinct governing decisions of the loaded findings that expire within 14 days.
 * @param {readonly FindingView[]} findings - Loaded findings with their governing decision
 * @param {Date} now - Current time, anchors expiring
 * @returns {number} - Number of expiring decisions
 */
export const countExpiringDecisions = (findings: readonly FindingView[], now: Date): number => {
  const ids = new Set<number>()

  for (const { decision, effective } of findings) {
    if (decision && effective && isExpiring({ decision, effective }, now)) {
      ids.add(decision.id)
    }
  }

  return ids.size
}
