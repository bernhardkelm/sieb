import {
  JUSTIFIABLE_STATUS,
  UPSTREAM_STATUS,
  type DecisionJustification,
  type DecisionStatus,
} from '#core/decision.ts'
import { defaultExpiresAt } from '#core/decisionExpiry.ts'
import { isPlainObject } from '#core/isPlainObject.ts'
import { isDecidableVerdict, statusOfVerdict } from '#core/proposal.ts'
import { generateProposalReason } from '#core/proposalReason.ts'
import type { ProposalClaims } from '#core/proposalRecord.ts'

/** Fields a reviewer may change before accepting, scope and images stay as proposed */
export const ACCEPT_EDIT_FIELDS = [
  'status',
  'justification',
  'reason',
  'expiresAt',
  'upstreamPending',
  'waitingFor',
] as const

export type AcceptEditField = (typeof ACCEPT_EDIT_FIELDS)[number]

/** What the decisions of an accepted proposal get */
export interface AcceptedDecisionValues {
  status: DecisionStatus
  justification: DecisionJustification | null
  reason: string
  expiresAt: string | null
  upstreamPending: boolean
  waitingFor: string | null
}

export interface AcceptPlan {
  values: AcceptedDecisionValues
  editedFields: AcceptEditField[] // edits that differ from the proposal
}

/**
 * Returns the decision values a proposal becomes with a status: its justification, the
 * generated reason, its review date as the expiry while that lies ahead, else the default
 * expiry of the status, and for fix_planned whether its fix waits for upstream and what for.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {Date} now - Current time
 * @param {DecisionStatus} status - Status the decisions get
 * @returns {AcceptedDecisionValues} - Decision values
 */
export const decisionValuesWith = (
  claims: ProposalClaims,
  now: Date,
  status: DecisionStatus,
): AcceptedDecisionValues => {
  const reviewDate = claims.review?.date ?? null
  const waitingFor =
    status === UPSTREAM_STATUS && claims.fix?.availability === 'upstream_pending'
      ? claims.fix.waitingFor
      : null

  return {
    status,
    justification: status === JUSTIFIABLE_STATUS ? claims.justification : null,
    reason: generateProposalReason(claims),
    expiresAt:
      reviewDate !== null && Date.parse(reviewDate) > now.getTime()
        ? reviewDate
        : defaultExpiresAt(status, now),
    upstreamPending: waitingFor !== null,
    waitingFor,
  }
}

/**
 * Returns the decision values a proposal becomes without edits, with the status of its verdict.
 * @param {ProposalClaims} claims - Proposal claims
 * @param {Date} now - Current time
 * @returns {AcceptedDecisionValues | null} - Decision values, null for inconclusive, which
 * becomes a decision only with the status and reason the reviewer sets
 */
export const proposalDecisionValues = (
  claims: ProposalClaims,
  now: Date,
): AcceptedDecisionValues | null =>
  isDecidableVerdict(claims.verdict)
    ? decisionValuesWith(claims, now, statusOfVerdict(claims.verdict))
    : null

/**
 * Returns whether an accept has to be refused as not_acceptable: an inconclusive proposal
 * without a status edit, the verdict itself never becomes a decision.
 * @param {Pick<ProposalClaims, 'verdict'>} claims - Proposal verdict
 * @param {unknown} edits - Raw edits, absent for none
 * @returns {boolean} - True when the reviewer has not decided a status
 */
export const lacksReviewerStatus = (
  claims: Pick<ProposalClaims, 'verdict'>,
  edits: unknown,
): boolean =>
  !isDecidableVerdict(claims.verdict) && !(isPlainObject(edits) && edits.status !== undefined)
