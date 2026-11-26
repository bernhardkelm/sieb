import type { Decision } from '#core/decision.ts'
import type { Proposal, ProposalDecisionRef, ProposalState } from '#core/proposal.ts'

export type ProposalCommandError =
  | 'not_found'
  | 'proposal_closed' // no longer open, with its state
  | 'proposal_conflict' // the expected decisions differ from the current ones
  | 'unknown_finding' // a target image has no open finding of the vulnerability
  | 'too_many_proposals' // the proposer holds MAX_OPEN_PROPOSALS open proposals

export interface ProposalRefusal {
  ok: false
  error: ProposalCommandError
  state?: ProposalState // proposal_closed
  currentDecisionIds?: ProposalDecisionRef[] // proposal_conflict
  imageRefs?: string[] // unknown_finding, the images without an open finding
}

export type CreateProposalResult =
  | { ok: true; proposal: Proposal; replacedProposalId: number | null }
  | ProposalRefusal

export type AcceptProposalResult =
  | { ok: true; proposal: Proposal; decisions: Decision[]; supersededIds: number[] }
  | ProposalRefusal

export type RejectProposalResult = { ok: true; proposal: Proposal } | ProposalRefusal
