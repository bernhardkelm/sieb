import type { DatabaseSync } from 'node:sqlite'

import { schemaVersion } from '#server/db/migrations.ts'

/**
 * Names the column of the image access snapshot at the schema version of a test database.
 * @param {DatabaseSync} db - Database at any schema version from 9 on
 * @returns {string} - image_access from schema step 21 on, else source_access
 */
export const accessColumn = (db: DatabaseSync): string =>
  schemaVersion(db) >= 21 ? 'image_access' : 'source_access'
