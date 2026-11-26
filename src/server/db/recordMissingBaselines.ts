import type { DatabaseSync } from 'node:sqlite'

import { SYSTEM_ACTOR } from '#core/decisionEvent.ts'
import type { Triage } from '#core/triage.ts'
import { addBaselines } from '#server/db/decisionBaselineRepository.ts'
import { appendDecisionEvent } from '#server/db/decisionEventRepository.ts'

/**
 * Records a baseline for every open finding a non-revoked decision governs without one yet,
 * from its current severity and KEV listing. This is how an all-scope decision covers images
 * the CVE newly appears in, and images that fall back to it when their own decision is revoked;
 * each such image gets an updated event with the payload { coveredImage } by sieb.
 * @param {DatabaseSync} db - Open database, inside a transaction
 * @param {Triage} triage - Triage of the current findings and decisions
 * @param {string} at - ISO time recorded on the baselines and events
 * @returns {number} - Baselines added
 */
export const recordMissingBaselines = (db: DatabaseSync, triage: Triage, at: string): number => {
  let added = 0

  for (const { decision, openFindings } of triage.byDecision.values()) {
    if (decision.revokedAt !== null) {
      continue
    }

    const known = new Set(decision.baselines.map((baseline) => baseline.imageRef))

    for (const finding of openFindings.filter((open) => !known.has(open.imageRef))) {
      const baseline = {
        imageRef: finding.imageRef,
        severity: finding.severity,
        kev: finding.kev,
        recordedAt: at,
      }

      if (addBaselines(db, decision.id, [baseline]) === 0) {
        continue
      }

      added += 1
      if (decision.scope === 'all') {
        appendDecisionEvent(db, {
          decisionId: decision.id,
          type: 'updated',
          actor: SYSTEM_ACTOR,
          at,
          payload: { coveredImage: finding.imageRef },
        })
      }
    }
  }

  return added
}
