import type { DatabaseSync } from 'node:sqlite'

import type { BulkDecisionSkip, BulkSkipReason } from '#core/decisionApiTypes.ts'
import { ALL_OPEN_IMAGES, type BulkDecisionInput } from '#core/bulkDecisionValidation.ts'
import type { Decision } from '#core/decision.ts'
import type { DecisionState } from '#core/effectiveDecision.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { listDecisionViewsByVuln } from '#server/db/findingViews.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

export interface BulkDecisionOutcome {
  created: Decision[]
  skipped: BulkDecisionSkip[]
}

/**
 * Resolves the target images of a bulk decision, all-open expands to every image with an open
 * finding of the vulnerability.
 * @param {DatabaseSync} db - Open database
 * @param {BulkDecisionInput} input - Validated input
 * @returns {string[]} - Image refs
 */
const targetImages = (db: DatabaseSync, input: BulkDecisionInput): string[] =>
  input.imageRefs === ALL_OPEN_IMAGES
    ? listFindingsByVuln(db, input.vulnId)
        .filter((finding) => finding.resolvedAt === null)
        .map((finding) => finding.imageRef)
    : input.imageRefs

/**
 * Names why an image with an existing decision was skipped, so the client can offer to extend
 * an expired one or re-confirm a re-opened one.
 * @param {DecisionState | undefined} state - State of the existing decision
 * @returns {BulkSkipReason} - expired, reopened, or decided for active and fix_planned ones
 */
const skipReason = (state: DecisionState | undefined): BulkSkipReason =>
  state === 'expired' || state === 'reopened' ? state : 'decided'

/**
 * Creates one image-scoped decision per target image in a single transaction. Images that
 * already have a non-revoked decision, or no finding of the vulnerability, are skipped and
 * reported with the state of the existing decision instead of failing the batch.
 * @param {DatabaseSync} db - Open database
 * @param {BulkDecisionInput} input - Validated input
 * @param {string} actor - Acting user
 * @param {Date} now - Current time
 * @returns {BulkDecisionOutcome} - Created decisions and skipped images
 */
export const createBulkDecisions = (
  db: DatabaseSync,
  input: BulkDecisionInput,
  actor: string,
  now: Date,
): BulkDecisionOutcome =>
  inTransaction(db, () => {
    const outcome: BulkDecisionOutcome = { created: [], skipped: [] }
    const states = new Map(
      listDecisionViewsByVuln(db, input.vulnId, now).map((view) => [
        view.decision.id,
        view.effective.state,
      ]),
    )

    for (const imageRef of targetImages(db, input)) {
      const result = createDecision(
        db,
        {
          vulnId: input.vulnId,
          scope: 'image',
          imageRef,
          status: input.status,
          justification: input.justification,
          reason: input.reason,
          expiresAt: input.expiresAt,
          upstreamPending: input.upstreamPending,
          waitingFor: input.waitingFor,
        },
        actor,
        now,
      )

      if (result.ok) {
        outcome.created.push(result.decision)
      } else {
        outcome.skipped.push({
          imageRef,
          reason:
            result.error === 'conflict'
              ? skipReason(states.get(result.decisionId ?? 0))
              : 'unknown_finding',
          decisionId: result.decisionId ?? null,
        })
      }
    }

    return outcome
  })
