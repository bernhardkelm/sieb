import type { DatabaseSync } from 'node:sqlite'

import { inTransaction } from '#server/db/inTransaction.ts'
import { MIGRATION_1 } from '#server/db/migrations/migration1.ts'
import { MIGRATION_2 } from '#server/db/migrations/migration2.ts'
import { MIGRATION_3 } from '#server/db/migrations/migration3.ts'
import { MIGRATION_4 } from '#server/db/migrations/migration4.ts'
import { MIGRATION_5 } from '#server/db/migrations/migration5.ts'
import { MIGRATION_6 } from '#server/db/migrations/migration6.ts'
import { MIGRATION_7 } from '#server/db/migrations/migration7.ts'
import { MIGRATION_8 } from '#server/db/migrations/migration8.ts'
import { MIGRATION_9 } from '#server/db/migrations/migration9.ts'
import { MIGRATION_10 } from '#server/db/migrations/migration10.ts'
import { MIGRATION_11 } from '#server/db/migrations/migration11.ts'
import { MIGRATION_12 } from '#server/db/migrations/migration12.ts'
import { MIGRATION_13 } from '#server/db/migrations/migration13.ts'
import { MIGRATION_14 } from '#server/db/migrations/migration14.ts'
import { MIGRATION_15 } from '#server/db/migrations/migration15.ts'
import { MIGRATION_16 } from '#server/db/migrations/migration16.ts'
import { MIGRATION_17 } from '#server/db/migrations/migration17.ts'
import { MIGRATION_18 } from '#server/db/migrations/migration18.ts'

/** Schema steps, step n brings the database to user_version n */
export const MIGRATIONS: string[] = [
  MIGRATION_1,
  MIGRATION_2,
  MIGRATION_3,
  MIGRATION_4,
  MIGRATION_5,
  MIGRATION_6,
  MIGRATION_7,
  MIGRATION_8,
  MIGRATION_9,
  MIGRATION_10,
  MIGRATION_11,
  MIGRATION_12,
  MIGRATION_13,
  MIGRATION_14,
  MIGRATION_15,
  MIGRATION_16,
  MIGRATION_17,
  MIGRATION_18,
]

/**
 * Reads the schema version stored in PRAGMA user_version.
 * @param {DatabaseSync} db - Open database
 * @returns {number} - Applied migration count
 */
export const schemaVersion = (db: DatabaseSync): number =>
  Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0)

/**
 * Applies all pending migrations in order, each step in its own transaction together with the
 * version bump, so a failed step leaves the previous version intact.
 * @param {DatabaseSync} db - Open database
 * @param {string[]} migrations - Ordered schema steps
 * @returns {void}
 * @throws {Error} - When the database is newer than the schema steps of this code
 */
export const runMigrations = (db: DatabaseSync, migrations: string[] = MIGRATIONS): void => {
  const current = schemaVersion(db)

  if (current > migrations.length) {
    throw new Error(
      `database schema version ${current} is newer than this code (${migrations.length}), update sieb first`,
    )
  }

  for (let version = current; version < migrations.length; version += 1) {
    inTransaction(db, () => {
      db.exec(migrations[version] ?? '')
      db.exec(`PRAGMA user_version = ${version + 1}`)
    })
  }
}
