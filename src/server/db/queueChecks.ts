import type { DatabaseSync } from 'node:sqlite'

import type { CheckSkip, CheckSkipReason } from '#core/check.ts'
import { eligibilityFactsOf, findingCheckBlocker } from '#core/checkEligibility.ts'
import { MAX_OPEN_CHECKS } from '#core/checkLimits.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { countOpenChecks, findingsWithOpenCheck, insertCheck } from '#server/db/checkRepository.ts'
import type { StoredCheck } from '#server/db/checkRows.ts'
import { getFinding } from '#server/db/findingRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import { readRelatedCoverage } from '#server/db/relatedCoverage.ts'
import { readImageAccessSources } from '#server/visibility/imageAccessSources.ts'

export interface QueueResult {
  queued: StoredCheck[]
  skipped: CheckSkip[]
}

export interface QueueRequest {
  findingIds: readonly number[] // distinct
  requestedBy: string
  publicRegistries: readonly string[]
  credentialVault?: CredentialVault | null // vault of usable credentials, null while private access is off
  maxOpen?: number // MAX_OPEN_CHECKS unless a test lowers it
  force?: boolean // queues findings an open proposal covers as related findings
}

/**
 * Queues one check per finding in request order, in one transaction. A finding is skipped in
 * the order of CHECK_SKIP_REASONS: unknown (not_found), resolved, its image is neither public
 * nor covered by a usable registry credential (not_public, or visibility_unknown for an own image
 * the pull probe has not answered for), it already has a queued or running check (already_open),
 * an open proposal lists it in relatedFindings and force is off (covered_by_proposal with the
 * proposal id), or maxOpen checks are open (queue_full).
 * @param {DatabaseSync} db - Open database
 * @param {QueueRequest} request - Distinct finding ids, requester, public registries, credential vault, open cap and force
 * @param {Date} now - Creation time
 * @returns {QueueResult} - Queued checks and skipped findings, both in request order
 */
export const queueChecks = (
  db: DatabaseSync,
  {
    findingIds,
    requestedBy,
    publicRegistries,
    credentialVault = null,
    maxOpen = MAX_OPEN_CHECKS,
    force = false,
  }: QueueRequest,
  now: Date,
): QueueResult =>
  inTransaction(db, () => {
    const sources = readImageAccessSources(db, { publicRegistries, credentialVault })
    const covered = force ? new Map<number, number>() : readRelatedCoverage(db)
    const open = findingsWithOpenCheck(db, findingIds)
    const result: QueueResult = { queued: [], skipped: [] }
    let openCount = countOpenChecks(db)

    for (const findingId of findingIds) {
      const finding = getFinding(db, findingId)
      const proposalId = covered.get(findingId)
      let reason: CheckSkipReason | null = findingCheckBlocker(eligibilityFactsOf(finding, sources))

      if (reason === null && open.has(findingId)) {
        reason = 'already_open'
      } else if (reason === null && proposalId !== undefined) {
        reason = 'covered_by_proposal'
      } else if (reason === null && openCount >= maxOpen) {
        reason = 'queue_full'
      }

      if (finding === null || reason !== null) {
        result.skipped.push(
          reason === 'covered_by_proposal'
            ? { findingId, reason, proposalId }
            : { findingId, reason: reason ?? 'not_found' },
        )
        continue
      }

      result.queued.push(
        insertCheck(
          db,
          { findingId, vulnId: finding.vulnId, imageRef: finding.imageRef, requestedBy },
          now,
        ),
      )
      open.add(findingId)
      openCount += 1
    }

    return result
  })
