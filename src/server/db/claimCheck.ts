import type { DatabaseSync } from 'node:sqlite'

import type { ApiToken } from '#core/apiToken.ts'
import {
  eligibilityFactsOf,
  findingCheckBlocker,
  type CheckBlocker,
} from '#core/checkEligibility.ts'
import { checkTokenExpiry } from '#core/checkLimits.ts'
import { NO_PULL_REF_ERROR } from '#core/checkPrompt.ts'
import { checkPullRef, type CheckPull } from '#core/checkPull.ts'
import type { Finding } from '#core/finding.ts'
import type { FindingInstance } from '#core/instance.ts'
import { getCheck } from '#server/db/checkRepository.ts'
import type { CheckRow, StoredCheck } from '#server/db/checkRows.ts'
import { toStoredCheck } from '#server/db/checkRows.ts'
import { mintCheckToken } from '#server/db/checkTokens.ts'
import { endCheck, failedOutcome } from '#server/db/endCheck.ts'
import { getFinding } from '#server/db/findingRepository.ts'
import { listInstances } from '#server/db/instanceRepository.ts'
import { inTransaction } from '#server/db/inTransaction.ts'

export interface ClaimedCheck {
  check: StoredCheck
  finding: Finding
  instances: FindingInstance[]
  pull: CheckPull
  token: ApiToken
  secret: string
}

export interface ClaimContext {
  publicRegistries: readonly string[]
  timeoutSeconds: number
}

/** Result of one claim: the started check and the queued ones that could not start */
export interface ClaimResult {
  claimed: ClaimedCheck | null
  skipped: StoredCheck[] // failed at claim: finding gone, resolved, no longer public or not pullable
}

const BLOCKER_ERRORS: Record<CheckBlocker, string> = {
  not_found: 'The finding no longer exists.',
  resolved: 'The finding was resolved before the check started.',
  not_public: 'The image is no longer public.',
}

/**
 * Reads the oldest queued check.
 * @param {DatabaseSync} db - Open database
 * @returns {StoredCheck | null} - Check, null for an empty queue
 */
const oldestQueued = (db: DatabaseSync): StoredCheck | null => {
  const row = db
    .prepare(`SELECT * FROM checks WHERE state = 'queued' ORDER BY id LIMIT 1`)
    .get() as CheckRow | undefined

  return row ? toStoredCheck(row) : null
}

/**
 * Marks a queued check running in phase preparing with the propose token of its requester.
 * @param {DatabaseSync} db - Open database
 * @param {StoredCheck} check - Queued check
 * @param {ClaimContext} context - Check timeout
 * @param {Date} now - Claim time
 * @returns {{ check: StoredCheck; token: ApiToken; secret: string }} - Running check, token and secret
 */
const startCheck = (
  db: DatabaseSync,
  check: StoredCheck,
  context: ClaimContext,
  now: Date,
): { check: StoredCheck; token: ApiToken; secret: string } => {
  const at = now.toISOString()
  const expiresAt = checkTokenExpiry(now, context.timeoutSeconds)
  const { token, secret } = mintCheckToken(
    db,
    { owner: check.requestedBy, checkId: check.id, expiresAt },
    now,
  )

  db.prepare(
    `UPDATE checks SET state = 'running', phase = 'preparing', started_at = ?,
       heartbeat_at = ?, token_id = ?
     WHERE id = ?`,
  ).run(at, at, token.id, check.id)

  return { check: getCheck(db, check.id) ?? check, token, secret }
}

/**
 * Starts the oldest queued check in one transaction unless a check is running: mints the propose
 * token of its requester and marks it running in phase preparing. Queued checks whose finding
 * is gone, resolved or no longer public, or whose image has neither a digest nor a tag, fail on
 * the way.
 * @param {DatabaseSync} db - Open database
 * @param {ClaimContext} context - Public registries and check timeout
 * @param {Date} now - Claim time
 * @returns {ClaimResult} - Started check with its token secret, and the checks that failed at claim
 */
export const claimCheck = (db: DatabaseSync, context: ClaimContext, now: Date): ClaimResult =>
  inTransaction(db, () => {
    const skipped: StoredCheck[] = []

    if (db.prepare(`SELECT 1 FROM checks WHERE state = 'running'`).get() !== undefined) {
      return { claimed: null, skipped }
    }

    for (let next = oldestQueued(db); next !== null; next = oldestQueued(db)) {
      const finding = getFinding(db, next.findingId)
      const blocker = findingCheckBlocker(eligibilityFactsOf(finding, context.publicRegistries))
      const instances = finding === null ? [] : listInstances(db, finding.id)
      const pull = finding === null ? null : checkPullRef(finding.imageRef, instances)

      if (finding === null || blocker !== null || pull === null) {
        const error = blocker === null ? NO_PULL_REF_ERROR : BLOCKER_ERRORS[blocker]
        const ended = endCheck(db, next, failedOutcome(error), now)

        skipped.push(ended?.check ?? next)
        continue
      }

      return {
        claimed: { ...startCheck(db, next, context, now), finding, instances, pull },
        skipped,
      }
    }

    return { claimed: null, skipped }
  })
