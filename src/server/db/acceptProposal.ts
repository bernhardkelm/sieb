import type { DatabaseSync } from 'node:sqlite'

import type { Decision, DecisionScope } from '#core/decision.ts'
import type { AcceptPlan } from '#core/proposalAccept.ts'
import { isDecidableVerdict, type Proposal, type ProposalProvenance } from '#core/proposal.ts'
import {
  currentDecisionRefs,
  matchesExpectedDecisions,
  type ExpectedDecisionId,
} from '#core/proposalFreshness.ts'
import { createDecision } from '#server/db/createDecision.ts'
import type { DecisionCommandResult } from '#server/db/decisionCommandResult.ts'
import { findCurrentDecision, listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import type { AcceptProposalResult } from '#server/db/proposalCommandResult.ts'
import { getProposal, resolveProposal } from '#server/db/proposalRepository.ts'
import { supersedeOverlapping } from '#server/db/supersedeOverlapping.ts'
import { updateDecision } from '#server/db/updateDecision.ts'

export interface AcceptProposalRequest {
  expectedDecisionIds: ExpectedDecisionId[]
  plan: AcceptPlan
  actor: string
  now: Date
}

/**
 * Writes the decision of one target: re-confirms and updates its current decision of the same
 * scope and image, or creates one.
 * @param {DatabaseSync} db - Open database, inside the accept transaction
 * @param {Proposal} proposal - Accepted proposal
 * @param {string | null} imageRef - Target image, null for the all-scope target
 * @param {AcceptProposalRequest} request - Plan, actor and time
 * @param {ProposalProvenance} provenance - Provenance for the event payload
 * @returns {Decision} - Written decision
 * @throws {Error} - When the decision command refuses, which rolls the accept back
 */
const writeDecision = (
  db: DatabaseSync,
  proposal: Proposal,
  imageRef: string | null,
  { plan, actor, now }: AcceptProposalRequest,
  provenance: ProposalProvenance,
): Decision => {
  const scope: DecisionScope = imageRef === null ? 'all' : 'image'
  const existing = findCurrentDecision(db, proposal.vulnId, scope, imageRef)
  const result: DecisionCommandResult = existing
    ? updateDecision(db, existing.id, { ...plan.values, reconfirm: true }, actor, now, provenance)
    : createDecision(
        db,
        { vulnId: proposal.vulnId, scope, imageRef, ...plan.values },
        actor,
        now,
        provenance,
      )

  if (!result.ok) {
    throw new Error(`accepting proposal ${proposal.id} failed: ${result.error}`)
  }

  return result.decision
}

/**
 * Accepts an open proposal in one transaction. An inconclusive one is not_acceptable unless the
 * reviewer set the status, its verdict never becomes a decision. The decisions governing its
 * targets must still be
 * the ones the reviewer saw, else proposal_conflict with the current ids. Per target image the
 * image-scoped decision is created, or updated and re-confirmed when one exists; scope all does
 * the same with the all-scope decision. The decision events carry the provenance, other open
 * proposals for an overlapping target are superseded.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Proposal id
 * @param {AcceptProposalRequest} request - Expected decisions, merged plan, actor and time
 * @returns {AcceptProposalResult} - Accepted proposal with its decisions, or the refusal
 */
export const acceptProposal = (
  db: DatabaseSync,
  id: number,
  request: AcceptProposalRequest,
): AcceptProposalResult =>
  inTransaction(db, () => {
    const proposal = getProposal(db, id)

    if (!proposal) {
      return { ok: false, error: 'not_found' }
    }

    if (proposal.state !== 'open') {
      return { ok: false, error: 'proposal_closed', state: proposal.state }
    }

    if (!isDecidableVerdict(proposal.verdict) && !request.plan.editedFields.includes('status')) {
      return { ok: false, error: 'not_acceptable' }
    }

    const current = currentDecisionRefs(proposal, listDecisionsByVuln(db, proposal.vulnId))

    if (!matchesExpectedDecisions(request.expectedDecisionIds, current)) {
      return {
        ok: false,
        error: 'proposal_conflict',
        currentDecisionIds: current,
      }
    }

    const provenance: ProposalProvenance = {
      proposalId: proposal.id,
      proposedBy: proposal.proposedBy,
      clientLabel: proposal.clientLabel,
      editedFields: request.plan.editedFields,
    }
    const decisions = (proposal.imageRefs ?? [null]).map((imageRef) =>
      writeDecision(db, proposal, imageRef, request, provenance),
    )
    const at = request.now.toISOString()

    resolveProposal(db, proposal.id, {
      state: 'accepted',
      resolution: request.plan.editedFields.length > 0 ? 'accepted_edited' : 'accepted',
      note: null,
      decisionIds: decisions.map((decision) => decision.id),
      at,
      by: request.actor,
    })

    const supersededIds = supersedeOverlapping(db, proposal, request.actor, at)
    const accepted = getProposal(db, proposal.id)

    if (!accepted) {
      throw new Error(`proposal ${proposal.id} vanished`)
    }

    return { ok: true, proposal: accepted, decisions, supersededIds }
  })
