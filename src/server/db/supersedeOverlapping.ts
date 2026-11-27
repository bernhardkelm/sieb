import type { DatabaseSync } from 'node:sqlite'

import type { Proposal } from '#core/proposalRecord.ts'
import { listProposals, resolveProposal } from '#server/db/proposalRepository.ts'

/**
 * Returns whether two proposals of the same vulnerability aim at an overlapping target: both
 * scope all, or both scope image with a shared image.
 * @param {Proposal} a - First proposal
 * @param {Proposal} b - Second proposal
 * @returns {boolean} - True when accepting one settles the other
 */
const overlaps = (a: Proposal, b: Proposal): boolean => {
  if (a.scope !== b.scope) {
    return false
  }

  const images = new Set(a.imageRefs ?? [])

  return a.scope === 'all' || (b.imageRefs ?? []).some((imageRef) => images.has(imageRef))
}

/**
 * Supersedes the other open proposals for a target that was just decided through a proposal,
 * from any proposer, with the resolution other_accepted.
 * @param {DatabaseSync} db - Open database, inside the accept transaction
 * @param {Proposal} accepted - Accepted proposal
 * @param {string} actor - Accepting user
 * @param {string} at - ISO time of the accept
 * @returns {number[]} - Ids of the superseded proposals
 */
export const supersedeOverlapping = (
  db: DatabaseSync,
  accepted: Proposal,
  actor: string,
  at: string,
): number[] =>
  listProposals(db, { state: 'open', vulnId: accepted.vulnId })
    .filter((other) => other.id !== accepted.id && overlaps(accepted, other))
    .map((other) => {
      resolveProposal(db, other.id, {
        state: 'superseded',
        resolution: 'other_accepted',
        note: null,
        decisionIds: [],
        at,
        by: actor,
      })

      return other.id
    })
