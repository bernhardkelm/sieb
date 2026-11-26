import { DECISION_STATES } from '#core/decisionStates.ts'
import type { DecisionView } from '#core/findingView.ts'

export const EXPIRING_WITHIN_DAYS = 14

export const DECISION_FILTERS = [...DECISION_STATES, 'expiring'] as const

export type DecisionFilter = (typeof DECISION_FILTERS)[number]

const DAY_MS = 24 * 60 * 60 * 1000

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
 * Returns whether a decision matches a filter: its state, or expiring for active decisions
 * that expire soon. Expiring decisions also match active.
 * @param {FilterableDecision} view - Decision with its state
 * @param {DecisionFilter} filter - Filter
 * @param {Date} now - Current time
 * @returns {boolean} - True on a match
 */
export const matchesDecisionFilter = (
  view: FilterableDecision,
  filter: DecisionFilter,
  now: Date,
): boolean => (filter === 'expiring' ? isExpiring(view, now) : view.effective.state === filter)
