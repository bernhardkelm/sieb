import type { DatabaseSync } from 'node:sqlite'

import { SYSTEM_ACTOR } from '#core/decisionEvent.ts'
import { listOpenFindings } from '#server/db/findingRepository.ts'
import { listProposals, resolveProposal } from '#server/db/proposalRepository.ts'

/**
 * Supersedes the open proposals whose findings all resolved: scope image when none of its
 * images has an open finding of the vulnerability left, scope all when the vulnerability has no
 * open finding at all. Call it inside the sync transaction after the snapshot is written.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Sync time
 * @returns {number} - Proposals superseded with the resolution finding_resolved
 */
export const supersedeResolvedProposals = (db: DatabaseSync, now: Date): number => {
  const open = listProposals(db, { state: 'open' })

  if (open.length === 0) {
    return 0
  }

  const openImages = new Map<string, Set<string>>()

  for (const finding of listOpenFindings(db)) {
    const images = openImages.get(finding.vulnId) ?? new Set<string>()

    images.add(finding.imageRef)
    openImages.set(finding.vulnId, images)
  }

  const at = now.toISOString()
  let superseded = 0

  for (const proposal of open) {
    const images = openImages.get(proposal.vulnId) ?? new Set<string>()
    const stillOpen =
      proposal.imageRefs === null
        ? images.size > 0
        : proposal.imageRefs.some((imageRef) => images.has(imageRef))

    if (stillOpen) {
      continue
    }

    resolveProposal(db, proposal.id, {
      state: 'superseded',
      resolution: 'finding_resolved',
      note: null,
      decisionIds: [],
      at,
      by: SYSTEM_ACTOR,
    })
    superseded += 1
  }

  return superseded
}
