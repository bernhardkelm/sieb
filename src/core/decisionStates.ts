import type { DecisionState, EffectiveDecision } from '#core/effectiveDecision.ts'

export const DECISION_STATES = [
  'active',
  'fix_planned',
  'expired',
  'reopened',
  'revoked',
] as const satisfies readonly DecisionState[]

/**
 * Counts decisions per state, every state present so the metric series stay stable.
 * @param {Iterable<{ effective: EffectiveDecision }>} decisions - Evaluated decisions
 * @returns {Record<DecisionState, number>} - Count per state
 */
export const countDecisionStates = (
  decisions: Iterable<{ effective: EffectiveDecision }>,
): Record<DecisionState, number> => {
  const counts = Object.fromEntries(DECISION_STATES.map((state) => [state, 0])) as Record<
    DecisionState,
    number
  >

  for (const { effective } of decisions) {
    counts[effective.state] += 1
  }

  return counts
}
