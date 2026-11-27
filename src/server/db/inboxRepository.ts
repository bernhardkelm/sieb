import type { DatabaseSync } from 'node:sqlite'

import { FINDING_SEEN_PREFIX } from '#core/findingSeen.ts'
import type { InboxFinding } from '#core/inbox/inboxItem.ts'
import type { Severity } from '#core/severity.ts'

/** Seen marks stay this long, past both 14-day Inbox windows, then the cleanup deletes them */
export const INBOX_SEEN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Most Inbox seen marks kept per user, marking more drops the oldest; finding marks prune themselves */
export const INBOX_SEEN_MAX_PER_USER = 5000

const FINDING_KEYS = `${FINDING_SEEN_PREFIX}%`

/**
 * Lists the open findings with the fields the Inbox reads.
 * @param {DatabaseSync} db - Open database
 * @returns {InboxFinding[]} - Open findings by id
 */
export const listInboxFindings = (db: DatabaseSync): InboxFinding[] => {
  const rows = db
    .prepare(
      `SELECT id, vuln_id, image_ref, severity, kev, title, kev_since FROM findings
       WHERE resolved_at IS NULL ORDER BY id`,
    )
    .all() as unknown as {
    id: number
    vuln_id: string
    image_ref: string
    severity: string
    kev: number
    title: string | null
    kev_since: string | null
  }[]

  return rows.map((row) => ({
    id: row.id,
    vulnId: row.vuln_id,
    imageRef: row.image_ref,
    severity: row.severity as Severity,
    kev: row.kev === 1,
    title: row.title,
    resolvedAt: null,
    kevSince: row.kev_since,
  }))
}

/**
 * Reads the seen marks of a user.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - User
 * @returns {Map<string, string>} - seen_at per item key
 */
export const readSeenMarks = (db: DatabaseSync, username: string): Map<string, string> => {
  const rows = db
    .prepare('SELECT item_key, seen_at FROM inbox_seen WHERE username = ?')
    .all(username) as unknown as { item_key: string; seen_at: string }[]

  return new Map(rows.map((row) => [row.item_key, row.seen_at]))
}

/**
 * Stores seen marks of a user, marking a key again moves its seen_at to now. Afterwards only the
 * newest `limit` Inbox marks of the user stay, finding marks do not count. Call it inside a
 * transaction for several keys.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - User
 * @param {readonly string[]} keys - Validated item keys
 * @param {Date} now - Mark time
 * @param {number} limit - Most marks kept for the user
 * @returns {void}
 */
export const markSeen = (
  db: DatabaseSync,
  username: string,
  keys: readonly string[],
  now: Date,
  limit = INBOX_SEEN_MAX_PER_USER,
): void => {
  const upsert = db.prepare(
    `INSERT INTO inbox_seen (username, item_key, seen_at) VALUES (?, ?, ?)
     ON CONFLICT (username, item_key) DO UPDATE SET seen_at = excluded.seen_at`,
  )
  const at = now.toISOString()

  for (const key of keys) {
    upsert.run(username, key, at)
  }

  db.prepare(
    `DELETE FROM inbox_seen WHERE username = ? AND item_key NOT LIKE ? AND item_key NOT IN (
       SELECT item_key FROM inbox_seen WHERE username = ? AND item_key NOT LIKE ?
       ORDER BY seen_at DESC, item_key DESC LIMIT ?
     )`,
  ).run(username, FINDING_KEYS, username, FINDING_KEYS, limit)
}

/**
 * Deletes seen marks older than INBOX_SEEN_RETENTION_MS.
 * @param {DatabaseSync} db - Open database
 * @param {Date} now - Cleanup time
 * @returns {number} - Number of deleted marks
 */
export const deleteStaleSeenMarks = (db: DatabaseSync, now: Date): number =>
  Number(
    db
      .prepare('DELETE FROM inbox_seen WHERE seen_at < ?')
      .run(new Date(now.getTime() - INBOX_SEEN_RETENTION_MS).toISOString()).changes,
  )
