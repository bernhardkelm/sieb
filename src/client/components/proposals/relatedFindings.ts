import type { ProposalDetail, ProposalRelatedFacts } from '#core/apiTypes.ts'
import type { BulkTarget } from '@/components/decision/bulkTargets'
import { TEXT_MAX_LENGTH, type DecisionFormInitial } from '@/components/decision/decisionFormModel'
import { editInitial } from '@/components/proposals/acceptEdits'

/** Related finding both actions act on: still open, held by sieb and without a decision */
export type PendingRelated = ProposalRelatedFacts & { vulnId: string; imageRef: string }

export const RELATED_SKIP_REASON = 'Decided and resolved findings are skipped.'
export const RELATED_DONE_REASON = 'Every finding of the same cause is decided or resolved.'
export const NO_VERDICT_REASON =
  'Claude could not determine a verdict to repeat, decide them yourself.'

/**
 * Returns whether a related finding is still open and undecided, what both actions act on.
 * @param {ProposalRelatedFacts} facts - Related finding
 * @returns {boolean} - True for an open finding sieb holds without a governing decision
 */
export const isPendingRelated = (facts: ProposalRelatedFacts): facts is PendingRelated =>
  facts.open && facts.vulnId !== null && facts.imageRef !== null && facts.effective === null

/**
 * Returns the related findings the actions act on.
 * @param {readonly ProposalRelatedFacts[]} related - Related findings of the detail
 * @returns {PendingRelated[]} - Open, undecided findings in the filed order
 */
export const pendingRelated = (related: readonly ProposalRelatedFacts[]): PendingRelated[] =>
  related.filter(isPendingRelated)

/**
 * Returns the bulk decision targets of the pending related findings, one per CVE.
 * @param {readonly PendingRelated[]} pending - Open, undecided related findings
 * @returns {BulkTarget[]} - Targets in the order the CVEs first appear
 */
export const relatedBulkTargets = (pending: readonly PendingRelated[]): BulkTarget[] => {
  const groups = new Map<string, string[]>()

  for (const facts of pending) {
    groups.set(facts.vulnId, [...(groups.get(facts.vulnId) ?? []), facts.imageRef])
  }

  return [...groups].map(([vulnId, imageRefs]) => ({ vulnId, imageRefs }))
}

/**
 * Returns the decision reason that cites the proposal: its shared reason, or its summary when
 * Claude gave none, cut to the longest reason the server takes.
 * @param {ProposalDetail['proposal']} proposal - Reviewed proposal
 * @returns {string} - Such as "Same cause as proposal #7: The module is a pseudo-version."
 */
export const sameCauseReason = (proposal: ProposalDetail['proposal']): string =>
  `Same cause as proposal #${proposal.id}: ${proposal.relatedReason ?? proposal.summary}`.slice(
    0,
    TEXT_MAX_LENGTH,
  )

/**
 * Returns the starting values of the bulk decision for the related findings: status,
 * justification, expiry and upstream fields as accepting the proposal writes them, with the reason
 * citing the proposal.
 * @param {ProposalDetail} detail - Reviewed proposal
 * @returns {DecisionFormInitial | null} - Form values, null for an inconclusive proposal
 */
export const relatedDecisionPrefill = (detail: ProposalDetail): DecisionFormInitial | null =>
  detail.decisionValues === null
    ? null
    : { ...editInitial(detail.decisionValues), reason: sameCauseReason(detail.proposal) }
