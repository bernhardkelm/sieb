import type { Decision } from '#core/decision.ts'
import type { Proposal } from '#core/proposalRecord.ts'
import { logSafe } from '#server/logSafe.ts'

/**
 * Describes the target of a proposal for a log line.
 * @param {Proposal} proposal - Proposal
 * @returns {string} - Vulnerability with scope and image count
 */
const targetText = (proposal: Proposal): string =>
  proposal.imageRefs === null
    ? `${logSafe(proposal.vulnId)} (all images)`
    : `${logSafe(proposal.vulnId)} (${proposal.imageRefs.length} image(s))`

/**
 * Builds the log line of a filed proposal, without any of its free text.
 * @param {Proposal} proposal - Stored proposal
 * @param {number | null} replacedId - Replaced open proposal of the same proposer
 * @returns {string} - Log line
 */
export const proposeLogLine = (proposal: Proposal, replacedId: number | null): string => {
  const token = proposal.tokenId === null ? '' : ` ${proposal.tokenId}`
  const replaced = replacedId === null ? '' : `, replaces ${replacedId}`

  return (
    `[sieb] proposal ${proposal.id} filed by ${logSafe(proposal.proposedBy)} via ` +
    `${proposal.proposedVia}${token} (${logSafe(proposal.clientLabel)}) for ` +
    `${targetText(proposal)}: ${proposal.verdict}, confidence ${proposal.confidence}${replaced}`
  )
}

/**
 * Builds the log line of an accepted proposal.
 * @param {{ proposal: Proposal; decisions: Decision[]; supersededIds: number[] }} result - Accept result
 * @param {string} actor - Accepting user
 * @returns {string} - Log line
 */
export const acceptLogLine = (
  result: { proposal: Proposal; decisions: Decision[]; supersededIds: number[] },
  actor: string,
): string => {
  const { proposal } = result
  const superseded =
    result.supersededIds.length === 0 ? '' : `, supersedes ${result.supersededIds.join(', ')}`

  return (
    `[sieb] proposal ${proposal.id} accepted by ${logSafe(actor)} for ${targetText(proposal)}: ` +
    `${proposal.resolution ?? 'accepted'}, decision(s) ${result.decisions.map((d) => d.id).join(', ')}` +
    superseded
  )
}

/**
 * Builds the log line of a rejected proposal, without the reason.
 * @param {Proposal} proposal - Rejected proposal
 * @param {string} actor - Rejecting user
 * @returns {string} - Log line
 */
export const rejectLogLine = (proposal: Proposal, actor: string): string =>
  `[sieb] proposal ${proposal.id} rejected by ${logSafe(actor)} for ${targetText(proposal)}`
