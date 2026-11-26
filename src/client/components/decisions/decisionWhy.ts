import { isExpiring } from '#core/decisionFilter.ts'
import type { DecisionView } from '#core/findingView.ts'
import { formatRelative } from '@/format/relativeTime'
import { reopenText } from '@/format/reopenText'

type WhyDecision = Pick<DecisionView, 'decision' | 'effective'>

/**
 * Explains why a decision needs attention: what re-opened it, or when it expires soon.
 * @param {WhyDecision} view - Decision with its state
 * @param {Date} now - Current time
 * @returns {string | null} - Explanation, null for decisions that need none
 */
export const decisionWhy = (view: WhyDecision, now: Date): string | null => {
  const { decision, effective } = view

  if (effective.state === 'reopened') {
    return reopenText(effective)
  }

  if (decision.expiresAt !== null && isExpiring(view, now)) {
    return `Expires ${formatRelative(decision.expiresAt, now)}`
  }

  return null
}
