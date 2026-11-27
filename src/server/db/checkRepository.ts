import type { DatabaseSync } from 'node:sqlite'

import type { CheckPhase } from '#core/check.ts'
import { MAX_RECENT_CHECKS } from '#core/checkLimits.ts'
import { toStoredCheck, type CheckRow, type StoredCheck } from '#server/db/checkRows.ts'

/**
 * Reads one check.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Check id
 * @returns {StoredCheck | null} - Check, null when unknown
 */
export const getCheck = (db: DatabaseSync, id: number): StoredCheck | null => {
  const row = db.prepare('SELECT * FROM checks WHERE id = ?').get(id) as CheckRow | undefined

  return row ? toStoredCheck(row) : null
}

/**
 * Lists the open checks, the running one first, then the queue in claim order.
 * @param {DatabaseSync} db - Open database
 * @returns {StoredCheck[]} - Running and queued checks
 */
export const listOpenChecks = (db: DatabaseSync): StoredCheck[] =>
  (
    db
      .prepare(
        `SELECT * FROM checks WHERE state IN ('queued', 'running')
         ORDER BY state = 'queued', id`,
      )
      .all() as unknown as CheckRow[]
  ).map(toStoredCheck)

/**
 * Counts the queued and running checks.
 * @param {DatabaseSync} db - Open database
 * @returns {number} - Open checks
 */
export const countOpenChecks = (db: DatabaseSync): number =>
  Number(
    db.prepare(`SELECT COUNT(*) AS n FROM checks WHERE state IN ('queued', 'running')`).get()?.n ??
      0,
  )

/**
 * Lists the queued and running checks of a requester.
 * @param {DatabaseSync} db - Open database
 * @param {string} requestedBy - Requester
 * @returns {StoredCheck[]} - Open checks, oldest first
 */
export const listOpenChecksOf = (db: DatabaseSync, requestedBy: string): StoredCheck[] =>
  (
    db
      .prepare(
        `SELECT * FROM checks WHERE state IN ('queued', 'running') AND requested_by = ?
         ORDER BY id`,
      )
      .all(requestedBy) as unknown as CheckRow[]
  ).map(toStoredCheck)

/**
 * Lists the newest finished and cancelled checks.
 * @param {DatabaseSync} db - Open database
 * @param {number} limit - Most rows returned
 * @returns {StoredCheck[]} - Checks, newest end first
 */
export const listRecentChecks = (db: DatabaseSync, limit = MAX_RECENT_CHECKS): StoredCheck[] =>
  (
    db
      .prepare(
        `SELECT * FROM checks WHERE finished_at IS NOT NULL
         ORDER BY finished_at DESC, id DESC LIMIT ?`,
      )
      .all(limit) as unknown as CheckRow[]
  ).map(toStoredCheck)

/**
 * Returns the ids of the findings among a list that have an open check.
 * @param {DatabaseSync} db - Open database
 * @param {readonly number[]} findingIds - Finding ids
 * @returns {Set<number>} - Ids with a queued or running check
 */
export const findingsWithOpenCheck = (
  db: DatabaseSync,
  findingIds: readonly number[],
): Set<number> => {
  const rows = db
    .prepare(
      `SELECT finding_id FROM checks WHERE state IN ('queued', 'running')
       AND finding_id IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(findingIds)) as { finding_id: number }[]

  return new Set(rows.map((row) => row.finding_id))
}

/**
 * Stores a queued check.
 * @param {DatabaseSync} db - Open database
 * @param {{ findingId: number; vulnId: string; imageRef: string; requestedBy: string }} check - Finding and requester
 * @param {Date} now - Creation time
 * @returns {StoredCheck} - Queued check
 */
export const insertCheck = (
  db: DatabaseSync,
  check: { findingId: number; vulnId: string; imageRef: string; requestedBy: string },
  now: Date,
): StoredCheck => {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(check.findingId, check.vulnId, check.imageRef, check.requestedBy, now.toISOString())
  const stored = getCheck(db, Number(lastInsertRowid))

  if (stored === null) {
    throw new Error(`check ${lastInsertRowid} vanished`)
  }

  return stored
}

/**
 * Records a heartbeat of a running check.
 * @param {DatabaseSync} db - Open database
 * @param {number} id - Check id
 * @param {CheckPhase} phase - Current phase
 * @param {Date} now - Heartbeat time
 * @returns {boolean} - True when the check was running
 */
export const touchRunningCheck = (
  db: DatabaseSync,
  id: number,
  phase: CheckPhase,
  now: Date,
): boolean =>
  db
    .prepare(`UPDATE checks SET phase = ?, heartbeat_at = ? WHERE id = ? AND state = 'running'`)
    .run(phase, now.toISOString(), id).changes > 0
