import type { DecisionStatus } from '#core/decision.ts'
import type { DecisionState } from '#core/effectiveDecision.ts'
import type { FindingView } from '#core/findingView.ts'

/** State of the decision governing a finding, undecided without one */
export type FindingDecisionState = DecisionState | 'undecided'

type VerdictFields = Pick<FindingView, 'decision' | 'effective' | 'resolvedAt'>

/**
 * Returns the state of the decision governing a finding.
 * @param {Pick<FindingView, 'effective'>} finding - Finding with its governing decision
 * @returns {FindingDecisionState} - Decision state, undecided without a governing decision
 */
export const findingDecisionState = (
  finding: Pick<FindingView, 'effective'>,
): FindingDecisionState => finding.effective?.state ?? 'undecided'

/**
 * Returns whether an open finding is governed by an active decision of a status. Expired,
 * revoked and re-opened decisions are not active.
 * @param {VerdictFields} finding - Finding with its governing decision
 * @param {DecisionStatus} status - Decision status
 * @returns {boolean} - True for an open finding whose active decision has the status
 */
const hasActiveStatus = (finding: VerdictFields, status: DecisionStatus): boolean =>
  finding.resolvedAt === null &&
  finding.effective?.state === 'active' &&
  finding.decision?.status === status

/**
 * Returns whether an open finding is governed by an active not_affected decision.
 * @param {VerdictFields} finding - Finding with its governing decision
 * @returns {boolean} - True when the finding does not affect its image
 */
export const isNotAffectedFinding = (finding: VerdictFields): boolean =>
  hasActiveStatus(finding, 'not_affected')

/**
 * Returns whether an open finding is governed by an active accepted decision.
 * @param {VerdictFields} finding - Finding with its governing decision
 * @returns {boolean} - True when its risk was accepted
 */
export const isAcceptedFinding = (finding: VerdictFields): boolean =>
  hasActiveStatus(finding, 'accepted')
