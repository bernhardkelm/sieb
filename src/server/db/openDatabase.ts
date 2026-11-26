import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { runMigrations } from '#server/db/migrations.ts'

export const MEMORY_DB = ':memory:'

/**
 * Opens the SQLite database, creating its directory when missing, enables WAL mode and foreign
 * keys and applies pending migrations.
 * @param {string} path - File path or ":memory:"
 * @returns {DatabaseSync} - Migrated database
 */
export const openDatabase = (path: string): DatabaseSync => {
  if (path !== MEMORY_DB) {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)

  return db
}
