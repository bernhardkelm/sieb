import type { DatabaseSync } from 'node:sqlite'

import type { DecisionInput } from '#core/decision.ts'
import { mustGetDecision, type DecisionCommandResult } from '#server/db/decisionCommandResult.ts'
import { appendDecisionEvent } from '#server/db/decisionEventRepository.ts'
import { findCurrentDecision } from '#server/db/decisionRepository.ts'
import { recordDecisionSnapshot } from '#server/db/decisionSnapshot.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

/**
 * Creates a decision with a baseline per governed image from the current severity and KEV
 * listing and writes its created event in the same transaction. One non-revoked decision per
 * vuln_id, scope and image.
 * @param {DatabaseSync} db - Open database
 * @param {DecisionInput} input - Validated input
 * @param {string} actor - Acting user
 * @param {Date} now - Current time
 * @returns {DecisionCommandResult} - New decision, or conflict with the existing decision id
 */
export const createDecision = (
  db: DatabaseSync,
  input: DecisionInput,
  actor: string,
  now: Date,
): DecisionCommandResult =>
  inTransaction(db, () => {
    const existing = findCurrentDecision(db, input.vulnId, input.scope, input.imageRef)

    if (existing) {
      return { ok: false, error: 'conflict', decisionId: existing.id }
    }

    const known = listFindingsByVuln(db, input.vulnId).some(
      (finding) => input.scope === 'all' || finding.imageRef === input.imageRef,
    )

    if (!known) {
      return { ok: false, error: 'unknown_finding' }
    }

    const at = now.toISOString()
    // summary placeholder, recordDecisionSnapshot needs the stored row to resolve governance
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO decisions (vuln_id, scope, image_ref, status, justification, reason,
           expires_at, created_by, created_at, updated_at, severity_at_decision, kev_at_decision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unknown', 0)`,
      )
      .run(
        input.vulnId,
        input.scope,
        input.imageRef,
        input.status,
        input.justification,
        input.reason,
        input.expiresAt,
        actor,
        at,
        at,
      )
    const id = Number(lastInsertRowid)

    recordDecisionSnapshot(db, { id, vulnId: input.vulnId }, at)
    const decision = mustGetDecision(db, id)

    appendDecisionEvent(db, {
      decisionId: decision.id,
      type: 'created',
      actor,
      at,
      payload: { ...decision },
    })
    return { ok: true, decision }
  })
