import type { FindingView } from '#core/findingView.ts'

/** States a finding filter accepts, active covers active not_affected and accepted decisions */
export const DECISION_STATE_FILTERS = [
  'undecided',
  'active',
  'not_affected',
  'accepted',
  'fix_planned',
  'expired',
  'reopened',
] as const

export type DecisionStateFilter = (typeof DECISION_STATE_FILTERS)[number]

/** States of the decision governing a finding, with the status of an active decision spelled out */
export const VERDICT_STATES = [
  'undecided',
  'not_affected',
  'accepted',
  'fix_planned',
  'expired',
  'reopened',
  'revoked',
] as const

export type VerdictState = (typeof VERDICT_STATES)[number]

type VerdictFields = Pick<FindingView, 'decision' | 'effective'>

/**
 * Returns whether a value is a known decision state filter.
 * @param {unknown} value - Value to test
 * @returns {boolean} - True for a DECISION_STATE_FILTERS entry
 */
export const isDecisionStateFilter = (value: unknown): value is DecisionStateFilter =>
  (DECISION_STATE_FILTERS as readonly unknown[]).includes(value)

/**
 * Returns the verdict state of a finding: undecided without a governing decision, the status
 * of an active decision, else the state of the governing decision.
 * @param {VerdictFields} finding - Finding with its governing decision
 * @returns {VerdictState} - Verdict state
 */
export const verdictState = (finding: VerdictFields): VerdictState => {
  if (finding.effective === null || finding.decision === null) {
    return 'undecided'
  }

  if (finding.effective.state === 'active') {
    return finding.decision.status
  }

  return finding.effective.state
}

/**
 * Returns whether a finding matches any of the decision state filters, active matching active
 * not_affected and accepted decisions.
 * @param {VerdictFields} finding - Finding with its governing decision
 * @param {readonly DecisionStateFilter[]} filters - Filters, empty matches everything
 * @returns {boolean} - True on a match
 */
export const matchesDecisionStates = (
  finding: VerdictFields,
  filters: readonly DecisionStateFilter[],
): boolean => {
  if (filters.length === 0) {
    return true
  }

  const state = verdictState(finding)
  const active = state === 'not_affected' || state === 'accepted'

  return (filters as readonly string[]).includes(state) || (active && filters.includes('active'))
}
