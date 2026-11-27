import type { DatabaseSync } from 'node:sqlite'

import { newSince } from '#core/findingRecency.ts'
import { FINDING_SEEN_PREFIX, findingSeenKey } from '#core/findingSeen.ts'

const FINDING_KEYS = `${FINDING_SEEN_PREFIX}%`
const ID_OFFSET = FINDING_SEEN_PREFIX.length + 1

/**
 * Reads which findings a user has marked seen.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - User
 * @returns {Set<number>} - Ids of the seen findings
 */
export const readSeenFindingIds = (db: DatabaseSync, username: string): Set<number> => {
  const rows = db
    .prepare('SELECT item_key FROM inbox_seen WHERE username = ? AND item_key LIKE ?')
    .all(username, FINDING_KEYS) as unknown as { item_key: string }[]

  return new Set(rows.map((row) => Number(row.item_key.slice(FINDING_SEEN_PREFIX.length))))
}

/**
 * Marks findings seen for a user in inbox_seen, only those first seen within the recent window,
 * and drops the user's finding marks that fell out of it, so their number stays bounded by the
 * recent findings. Call it inside a transaction.
 * @param {DatabaseSync} db - Open database
 * @param {string} username - User
 * @param {readonly number[]} ids - Validated finding ids
 * @param {Date} now - Mark time
 * @returns {number[]} - Ids that were not marked: unknown or outside the window
 */
export const markFindingsSeen = (
  db: DatabaseSync,
  username: string,
  ids: readonly number[],
  now: Date,
): number[] => {
  const since = newSince(now)
  const recent = db.prepare('SELECT 1 FROM findings WHERE id = ? AND first_seen >= ?')
  const upsert = db.prepare(
    `INSERT INTO inbox_seen (username, item_key, seen_at) VALUES (?, ?, ?)
     ON CONFLICT (username, item_key) DO UPDATE SET seen_at = excluded.seen_at`,
  )
  const at = now.toISOString()
  const ignored = ids.filter((id) => recent.get(id, since) === undefined)
  const skipped = new Set(ignored)

  for (const id of ids) {
    if (!skipped.has(id)) {
      upsert.run(username, findingSeenKey(id), at)
    }
  }

  db.prepare(
    `DELETE FROM inbox_seen WHERE username = ? AND item_key LIKE ? AND NOT EXISTS (
       SELECT 1 FROM findings
       WHERE findings.id = CAST(substr(inbox_seen.item_key, ?) AS INTEGER) AND first_seen >= ?
     )`,
  ).run(username, FINDING_KEYS, ID_OFFSET, since)

  return ignored
}
