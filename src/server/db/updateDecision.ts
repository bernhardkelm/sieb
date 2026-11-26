import type { DatabaseSync } from 'node:sqlite'

import { JUSTIFIABLE_STATUS, type Decision, type DecisionPatch } from '#core/decision.ts'
import { defaultExpiresAt } from '#core/decisionExpiry.ts'
import type { ProposalProvenance } from '#core/proposal.ts'
import { mustGetDecision, type DecisionCommandResult } from '#server/db/decisionCommandResult.ts'
import { appendDecisionEvent } from '#server/db/decisionEventRepository.ts'
import { getDecision } from '#server/db/decisionRepository.ts'
import { recordDecisionSnapshot } from '#server/db/decisionSnapshot.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

const DIFF_FIELDS = [
  'status',
  'justification',
  'reason',
  'expiresAt',
  'severityAtDecision',
  'kevAtDecision',
  'reopenedAt',
] as const

/**
 * Changes a decision. A status change without an explicit expiry resets the expiry to the
 * default of the new status. A status other than not_affected clears the justification, and a
 * justification for a decision that is not not_affected after the patch is refused. Only a
 * patch with reconfirm clears a latched re-open and records new baselines at the current
 * findings; any other edit, a reason fix included, keeps a re-opened decision re-opened. Writes
 * an updated event with reconfirm and the changed fields as [before, after], plus the provenance
 * of a change from an accepted proposal.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Decision id
 * @param {DecisionPatch} patch - Validated change
 * @param {string} actor - Acting user
 * @param {Date} now - Current time
 * @param {ProposalProvenance | null} provenance - Accepted proposal behind the change, null for none
 * @returns {DecisionCommandResult} - Changed decision or the reason it was refused
 */
export const updateDecision = (
  db: DatabaseSync,
  id: number,
  patch: DecisionPatch,
  actor: string,
  now: Date,
  provenance: ProposalProvenance | null = null,
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

    if (status !== JUSTIFIABLE_STATUS && patch.justification) {
      return { ok: false, error: 'justification_not_allowed' }
    }

    const justification =
      status !== JUSTIFIABLE_STATUS
        ? null
        : patch.justification !== undefined
          ? patch.justification
          : before.justification
    const expiresAt =
      patch.expiresAt !== undefined
        ? patch.expiresAt
        : status !== before.status
          ? defaultExpiresAt(status, now)
          : before.expiresAt

    db.prepare(
      `UPDATE decisions SET status = ?, justification = ?, reason = ?, expires_at = ?,
         updated_at = ? WHERE id = ?`,
    ).run(status, justification, patch.reason ?? before.reason, expiresAt, at, id)

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
      payload: provenance === null ? { reconfirm, ...diff } : { reconfirm, ...diff, provenance },
    })
    return { ok: true, decision: after }
  })
