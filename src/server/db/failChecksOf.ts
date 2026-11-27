import type { DatabaseSync } from 'node:sqlite'

import { listOpenChecksOf } from '#server/db/checkRepository.ts'
import { endCheck, failedOutcome, type EndedCheck } from '#server/db/endCheck.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

/** Error of the open checks of a user the identity provider no longer admits */
export const REFUSED_REQUESTER_ERROR = 'The requester no longer has access to sieb.'

/**
 * Fails every queued and running check of a requester in one transaction and deletes the token
 * of the running one, so no later claim mints a token for that user.
 * @param {DatabaseSync} db - Open database
 * @param {string} requestedBy - Requester
 * @param {string} error - Error text for humans
 * @param {Date} now - End time
 * @returns {EndedCheck[]} - Failed checks and their deleted tokens
 */
export const failChecksOf = (
  db: DatabaseSync,
  requestedBy: string,
  error: string,
  now: Date,
): EndedCheck[] =>
  inTransaction(db, () =>
    listOpenChecksOf(db, requestedBy).flatMap((check) => {
      const ended = endCheck(db, check, failedOutcome(error), now)

      return ended === null ? [] : [ended]
    }),
  )
