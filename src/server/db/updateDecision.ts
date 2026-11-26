import type { DatabaseSync } from 'node:sqlite'

import type { Decision, DecisionPatch } from '#core/decision.ts'
import { defaultExpiresAt } from '#core/decisionExpiry.ts'
import { mustGetDecision, type DecisionCommandResult } from '#server/db/decisionCommandResult.ts'
import { appendDecisionEvent } from '#server/db/decisionEventRepository.ts'
import { getDecision } from '#server/db/decisionRepository.ts'
import { recordDecisionSnapshot } from '#server/db/decisionSnapshot.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

const DIFF_FIELDS = [
  'status',
  'reason',
  'expiresAt',
  'severityAtDecision',
  'kevAtDecision',
  'reopenedAt',
] as const

/**
 * Changes a decision. A status change without an explicit expiry resets the expiry to the
 * default of the new status. Only a patch with reconfirm clears a latched re-open and records
 * new baselines at the current findings; any other edit, a reason fix included, keeps a
 * re-opened decision re-opened. Writes an updated event with reconfirm and the changed fields
 * as [before, after].
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Decision id
 * @param {DecisionPatch} patch - Validated change
 * @param {string} actor - Acting user
 * @param {Date} now - Current time
 * @returns {DecisionCommandResult} - Changed decision or the reason it was refused
 */
export const updateDecision = (
  db: DatabaseSync,
  id: number,
  patch: DecisionPatch,
  actor: string,
  now: Date,
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
    const reconfirm = patch.reconfirm === true
    const status = patch.status ?? before.status
    const expiresAt =
      patch.expiresAt !== undefined
        ? patch.expiresAt
        : status !== before.status
          ? defaultExpiresAt(status, now)
          : before.expiresAt

    db.prepare(
      'UPDATE decisions SET status = ?, reason = ?, expires_at = ?, updated_at = ? WHERE id = ?',
    ).run(status, patch.reason ?? before.reason, expiresAt, at, id)

    if (reconfirm) {
      db.prepare('UPDATE decisions SET reopened_at = NULL, reopen_trigger = NULL WHERE id = ?').run(
        id,
      )
      recordDecisionSnapshot(db, before, at)
    }

    const after: Decision = mustGetDecision(db, id)
    const diff = Object.fromEntries(
      DIFF_FIELDS.filter((field) => before[field] !== after[field]).map((field) => [
        field,
        [before[field], after[field]],
      ]),
    )

    appendDecisionEvent(db, {
      decisionId: id,
      type: 'updated',
      actor,
      at,
      payload: { reconfirm, ...diff },
    })
    return { ok: true, decision: after }
  })
