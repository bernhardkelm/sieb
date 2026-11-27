import type { DatabaseSync } from 'node:sqlite'

import { isDecidableVerdict } from '#core/proposal.ts'
import type { BulkAcceptItem, BulkProposalOutcome } from '#core/proposalBulk.ts'
import { validateAcceptEdits } from '#core/proposalAcceptEdits.ts'
import { currentDecisionRefs, isProposalOutdated } from '#core/proposalFreshness.ts'
import { acceptProposal } from '#server/db/acceptProposal.ts'
import { listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import type {
  AcceptProposalResult,
  ProposalCommandError,
  RejectProposalResult,
} from '#server/db/proposalCommandResult.ts'
import { getProposal } from '#server/db/proposalRepository.ts'
import { rejectProposal } from '#server/db/rejectProposal.ts'

type Accepted = Extract<AcceptProposalResult, { ok: true }>

type Rejected = Extract<RejectProposalResult, { ok: true }>

/** Outcome of one proposal in a batch, with the command result when it was written */
export type BatchStep<T> = {
  vulnId: string | null
  outcome: BulkProposalOutcome
  written: T | null
}

export interface BatchActor {
  actor: string
  now: Date
}

/**
 * Maps a refusal of the accept or reject command to its bulk outcome.
 * @param {ProposalCommandError} error - Refusal code
 * @returns {BulkProposalOutcome} - Outcome
 */
const refusalOutcome = (error: ProposalCommandError): BulkProposalOutcome => {
  switch (error) {
    case 'not_found':
      return 'not_found'
    case 'proposal_closed':
      return 'not_open'
    case 'proposal_conflict':
      return 'outdated'
    default:
      return 'not_acceptable'
  }
}

/**
 * Accepts one proposal of a bulk accept unchanged, in a transaction of its own. Skipped without
 * a write: an unknown or closed proposal, an inconclusive one, and an outdated one, whose
 * governing decisions changed since it was filed or differ from the expected ones; a bulk
 * accept never overrides a decision the reviewer has not seen.
 * @param {DatabaseSync} db - Open database
 * @param {BulkAcceptItem} item - Proposal id and the decisions the reviewer saw
 * @param {BatchActor} by - Acting user and time
 * @returns {BatchStep<Accepted>} - Outcome, with the accept result when accepted
 */
export const acceptUnchanged = (
  db: DatabaseSync,
  item: BulkAcceptItem,
  { actor, now }: BatchActor,
): BatchStep<Accepted> => {
  const proposal = getProposal(db, item.id)

  if (proposal === null) {
    return { vulnId: null, outcome: 'not_found', written: null }
  }

  /**
   * Builds a step without a write.
   * @param {BulkProposalOutcome} outcome - Outcome
   * @returns {BatchStep<Accepted>} - Step
   */
  const skip = (outcome: BulkProposalOutcome): BatchStep<Accepted> => ({
    vulnId: proposal.vulnId,
    outcome,
    written: null,
  })

  if (proposal.state !== 'open') {
    return skip('not_open')
  }

  if (!isDecidableVerdict(proposal.verdict)) {
    return skip('inconclusive')
  }

  const current = currentDecisionRefs(proposal, listDecisionsByVuln(db, proposal.vulnId))

  if (isProposalOutdated(proposal.basisDecisions, current)) {
    return skip('outdated')
  }

  const plan = validateAcceptEdits(proposal, undefined, now)

  if (!plan.ok) {
    return skip('not_acceptable')
  }

  const result = acceptProposal(db, item.id, {
    expectedDecisionIds: item.expectedDecisionIds,
    plan: plan.value,
    actor,
    now,
  })

  return result.ok
    ? { vulnId: proposal.vulnId, outcome: 'accepted', written: result }
    : skip(refusalOutcome(result.error))
}

/**
 * Rejects one proposal of a bulk reject, in a transaction of its own.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Proposal id
 * @param {string} reason - Validated reason shared by the batch
 * @param {BatchActor} by - Acting user and time
 * @returns {BatchStep<Rejected>} - Outcome, with the reject result when rejected
 */
export const rejectOne = (
  db: DatabaseSync,
  id: number,
  reason: string,
  { actor, now }: BatchActor,
): BatchStep<Rejected> => {
  const vulnId = getProposal(db, id)?.vulnId ?? null
  const result = rejectProposal(db, id, reason, actor, now)

  return result.ok
    ? { vulnId, outcome: 'rejected', written: result }
    : { vulnId, outcome: refusalOutcome(result.error), written: null }
}
