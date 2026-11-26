import type { DatabaseSync } from 'node:sqlite'

import { mustGetDecision, type DecisionCommandResult } from '#server/db/decisionCommandResult.ts'
import { appendDecisionEvent } from '#server/db/decisionEventRepository.ts'
import { resolveTriage } from '#core/triage.ts'
import { getDecision, listDecisionsByVuln } from '#server/db/decisionRepository.ts'
import { listFindingsByVuln } from '#server/db/findingRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'
import { recordMissingBaselines } from '#server/db/recordMissingBaselines.ts'

/**
 * Revokes a decision, its findings return to the inbox or fall back to the all-scope decision
 * of the vuln_id, which records their baselines right away. Writes a revoked event with the
 * optional comment.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Decision id
 * @param {string} actor - Acting user
 * @param {Date} now - Current time
 * @param {string | null} comment - Optional reason for the revocation
 * @returns {DecisionCommandResult} - Revoked decision or the reason it was refused
 */
export const revokeDecision = (
  db: DatabaseSync,
  id: number,
  actor: string,
  now: Date,
  comment: string | null = null,
): DecisionCommandResult =>
  inTransaction(db, () => {
    const before = getDecision(db, id)

    if (!before) {
      return { ok: false, error: 'not_found' }
    }

    if (before.revokedAt !== null) {
      return { ok: false, error: 'revoked', decisionId: id }
    }

    const at = now.toISOString()

    db.prepare(
      'UPDATE decisions SET revoked_at = ?, revoked_by = ?, updated_at = ? WHERE id = ?',
    ).run(at, actor, at, id)
    appendDecisionEvent(db, { decisionId: id, type: 'revoked', actor, at, payload: { comment } })
    recordMissingBaselines(
      db,
      resolveTriage(
        listFindingsByVuln(db, before.vulnId),
        listDecisionsByVuln(db, before.vulnId),
        now,
      ),
      at,
    )
    return { ok: true, decision: mustGetDecision(db, id) }
  })
