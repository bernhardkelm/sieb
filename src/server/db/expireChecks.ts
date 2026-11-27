import type { DatabaseSync } from 'node:sqlite'

import { checkTimeoutError } from '#core/checkLimits.ts'
import { listOpenChecks } from '#server/db/checkRepository.ts'
import { endCheck, failedOutcome, type EndedCheck } from '#server/db/endCheck.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

/**
 * Fails every running check that timed out, see checkTimeoutError, and deletes its token.
 * @param {DatabaseSync} db - Open database
 * @param {number} timeoutSeconds - Configured check timeout
 * @param {Date} now - Current time
 * @returns {EndedCheck[]} - Timed out checks and their deleted tokens
 */
export const expireChecks = (db: DatabaseSync, timeoutSeconds: number, now: Date): EndedCheck[] =>
  inTransaction(db, () =>
    listOpenChecks(db).flatMap((check) => {
      if (check.state !== 'running' || check.startedAt === null || check.heartbeatAt === null) {
        return []
      }

      const error = checkTimeoutError(
        { startedAt: check.startedAt, heartbeatAt: check.heartbeatAt },
        now,
        timeoutSeconds,
      )
      const ended = error === null ? null : endCheck(db, check, failedOutcome(error), now)

      return ended === null ? [] : [ended]
    }),
  )
