import type { DatabaseSync } from 'node:sqlite'

import type { ApiToken } from '#core/apiToken.ts'
import type { CheckUsage } from '#core/check.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import type { StoredCheck } from '#server/db/checkRows.ts'
import { dropCheckToken } from '#server/db/checkTokens.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

/** How an open check ends */
export interface CheckOutcome {
  state: 'done' | 'failed' | 'cancelled'
  error: string | null // failed only
  durationMs: number | null
  usage: CheckUsage | null
  reply: string | null
  pulledDigest?: string | null // done and failed results of the worker only
}

/** An ended check and its deleted token, null when the check had none or it was gone */
export interface EndedCheck {
  check: StoredCheck
  token: ApiToken | null
}

export const CANCELLED: CheckOutcome = {
  state: 'cancelled',
  error: null,
  durationMs: null,
  usage: null,
  reply: null,
}

/**
 * Returns the newest proposal filed with a token.
 * @param {DatabaseSync} db - Open database
 * @param {number} tokenId - Token id
 * @returns {number | null} - Proposal id, null when the token filed none
 */
const newestProposalOf = (db: DatabaseSync, tokenId: number): number | null => {
  const row = db
    .prepare('SELECT id FROM decision_proposals WHERE token_id = ? ORDER BY id DESC LIMIT 1')
    .get(tokenId) as { id: number } | undefined

  return row?.id ?? null
}

/**
 * Ends an open check in one transaction: stores the outcome, links the newest proposal filed
 * with its token, then deletes that token.
 * @param {DatabaseSync} db - Open database
 * @param {StoredCheck} check - Queued or running check
 * @param {CheckOutcome} outcome - Final state and what the worker reported
 * @param {Date} now - End time
 * @returns {EndedCheck | null} - Ended check and its deleted token, null when the check was no longer open
 */
export const endCheck = (
  db: DatabaseSync,
  check: StoredCheck,
  outcome: CheckOutcome,
  now: Date,
): EndedCheck | null =>
  inTransaction(db, () => {
    const proposalId = check.tokenId === null ? null : newestProposalOf(db, check.tokenId)
    const { changes } = db
      .prepare(
        `UPDATE checks SET state = ?, finished_at = ?, error = ?, duration_ms = ?, usage = ?,
           reply = ?, proposal_id = ?, pulled_digest = ?
         WHERE id = ? AND state IN ('queued', 'running')`,
      )
      .run(
        outcome.state,
        now.toISOString(),
        outcome.state === 'failed' ? outcome.error : null,
        outcome.durationMs,
        outcome.usage === null ? null : JSON.stringify(outcome.usage),
        outcome.reply,
        proposalId,
        outcome.pulledDigest ?? null,
        check.id,
      )

    if (changes === 0) {
      return null
    }

    const token =
      check.tokenId === null
        ? null
        : dropCheckToken(db, { owner: check.requestedBy, tokenId: check.tokenId })
    const ended = getCheck(db, check.id)

    if (ended === null) {
      throw new Error(`check ${check.id} vanished`)
    }

    return { check: ended, token }
  })
