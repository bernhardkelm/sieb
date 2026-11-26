import type { DatabaseSync } from 'node:sqlite'

import type { Triage } from '#core/triage.ts'
import { addBaselines } from '#server/db/decisionBaselineRepository.ts'

/**
 * Records a baseline for every open finding a non-revoked decision governs without one yet,
 * from its current severity and KEV listing. This is how an all-scope decision covers images
 * the CVE newly appears in, and images that fall back to it when their own decision is revoked.
 * @param {DatabaseSync} db - Open database, inside a transaction
 * @param {Triage} triage - Triage of the current findings and decisions
 * @param {string} at - ISO time recorded on the baselines
 * @returns {number} - Baselines added
 */
export const recordMissingBaselines = (db: DatabaseSync, triage: Triage, at: string): number => {
  let added = 0

  for (const { decision, openFindings } of triage.byDecision.values()) {
    const known = new Set(decision.baselines.map((baseline) => baseline.imageRef))
    const missing = openFindings.filter(
      (finding) => decision.revokedAt === null && !known.has(finding.imageRef),
    )

    if (missing.length > 0) {
      added += addBaselines(
        db,
        decision.id,
        missing.map((finding) => ({
          imageRef: finding.imageRef,
          severity: finding.severity,
          kev: finding.kev,
          recordedAt: at,
        })),
      )
    }
  }

  return added
}
