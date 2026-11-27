import { DECISION_STATES } from '#core/decisionStates.ts'
import type { DecisionView } from '#core/findingView.ts'
import { DAY_MS } from '#core/timeUnits.ts'

export const EXPIRING_WITHIN_DAYS = 14

export const DECISION_FILTERS = [...DECISION_STATES, 'expiring', 'upstream_pending'] as const

export type DecisionFilter = (typeof DECISION_FILTERS)[number]

type FilterableDecision = Pick<DecisionView, 'decision' | 'effective'>

/**
 * Returns whether a value is a known decision filter.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for a decision state or expiring
 */
export const isDecisionFilter = (value: unknown): value is DecisionFilter =>
  (DECISION_FILTERS as readonly unknown[]).includes(value)

/**
 * Returns whether an active decision expires within the next 14 days.
 * @param {FilterableDecision} view - Decision with its state
 * @param {Date} now - Current time
 * @returns {boolean} - True for active decisions expiring soon
 */
export const isExpiring = (view: FilterableDecision, now: Date): boolean =>
  view.effective.state === 'active' &&
  view.decision.expiresAt !== null &&
  Date.parse(view.decision.expiresAt) - now.getTime() <= EXPIRING_WITHIN_DAYS * DAY_MS

/**
 * Returns whether a decision waits for upstream and is not revoked.
 * @param {FilterableDecision} view - Decision with its state
 * @returns {boolean} - True for a non-revoked upstreamPending decision
 */
export const isUpstreamPending = (view: FilterableDecision): boolean =>
  view.decision.upstreamPending && view.effective.state !== 'revoked'

/**
 * Returns whether a decision matches a filter: its state, expiring for active decisions that
 * expire soon, or upstream_pending for non-revoked ones waiting for upstream. Expiring decisions
 * also match active, upstream_pending ones their state.
 * @param {FilterableDecision} view - Decision with its state
 * @param {DecisionFilter} filter - Filter
 * @param {Date} now - Current time
 * @returns {boolean} - True on a match
 */
export const matchesDecisionFilter = (
  view: FilterableDecision,
  filter: DecisionFilter,
  now: Date,
): boolean => {
  if (filter === 'expiring') {
    return isExpiring(view, now)
  }

  return filter === 'upstream_pending' ? isUpstreamPending(view) : view.effective.state === filter
}
