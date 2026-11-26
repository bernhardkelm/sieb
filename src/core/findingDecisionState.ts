import type { DecisionState } from '#core/effectiveDecision.ts'
import type { FindingView } from '#core/findingView.ts'

/** State of the decision governing a finding, undecided without one */
export type FindingDecisionState = DecisionState | 'undecided'

/**
 * Returns the state of the decision governing a finding.
 * @param {Pick<FindingView, 'effective'>} finding - Finding with its governing decision
 * @returns {FindingDecisionState} - Decision state, undecided without a governing decision
 */
export const findingDecisionState = (
  finding: Pick<FindingView, 'effective'>,
): FindingDecisionState => finding.effective?.state ?? 'undecided'

/**
 * Returns whether the decision governing a finding silences its alerts.
 * @param {Pick<FindingView, 'effective' | 'resolvedAt'>} finding - Finding
 * @returns {boolean} - True for open findings with an active decision
 */
export const isSuppressedFinding = (
  finding: Pick<FindingView, 'effective' | 'resolvedAt'>,
): boolean => finding.resolvedAt === null && finding.effective?.state === 'active'
