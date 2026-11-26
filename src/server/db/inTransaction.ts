import type { DatabaseSync } from 'node:sqlite'

/**
 * Runs a synchronous callback inside an immediate transaction, rolling back when it throws.
 * Inside an open transaction it just runs the callback, so commands compose into one atomic
 * batch. A failing rollback never hides the error of the callback.
 * @param {DatabaseSync} db - Open database
 * @param {() => T} work - Statements to run atomically
 * @returns {T} - Result of the callback
 */
export const inTransaction = <T>(db: DatabaseSync, work: () => T): T => {
  if (db.isTransaction) {
    return work()
  }

  db.exec('BEGIN IMMEDIATE')

  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // SQLite rolls back by itself on some errors, then ROLLBACK fails with no active transaction
    }

    throw error
  }
}
