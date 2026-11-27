import type { DatabaseSync } from 'node:sqlite'

import type { Decision } from '#core/decision.ts'
import type { InboxProposal } from '#core/inbox/inboxItem.ts'
import { patchActionOf } from '#core/patchAction.ts'
import { currentDecisionRefs, isProposalOutdated } from '#core/proposalFreshness.ts'
import { listProposals } from '#server/db/proposalRepository.ts'

/**
 * Groups decisions by vuln_id.
 * @param {readonly Decision[]} decisions - Decisions, revoked ones included
 * @returns {Map<string, Decision[]>} - Decisions per vuln_id
 */
const byVuln = (decisions: readonly Decision[]): Map<string, Decision[]> => {
  const grouped = new Map<string, Decision[]>()

  for (const decision of decisions) {
    grouped.set(decision.vulnId, [...(grouped.get(decision.vulnId) ?? []), decision])
  }

  return grouped
}

/**
 * Lists the open proposals with the fields the Inbox reads, among them the decisions that govern
 * their targets now and whether one changed since the proposal was filed.
 * @param {DatabaseSync} db - Open database
 * @param {readonly Decision[]} decisions - Every decision, revoked ones included
 * @returns {InboxProposal[]} - Open proposals, newest first
 */
export const listInboxProposals = (
  db: DatabaseSync,
  decisions: readonly Decision[],
): InboxProposal[] => {
  const grouped = byVuln(decisions)

  return listProposals(db, { state: 'open' }).map((proposal) => {
    const current = currentDecisionRefs(proposal, grouped.get(proposal.vulnId) ?? [])

    return {
      id: proposal.id,
      vulnId: proposal.vulnId,
      imageRefs: proposal.imageRefs,
      createdAt: proposal.createdAt,
      verdict: proposal.verdict,
      confidence: proposal.confidence,
      patchAction: patchActionOf(proposal),
      clientKind: proposal.clientKind,
      clientLabel: proposal.clientLabel,
      agent: proposal.agent,
      currentDecisionIds: current,
      outdated: isProposalOutdated(proposal.basisDecisions, current),
    }
  })
}
