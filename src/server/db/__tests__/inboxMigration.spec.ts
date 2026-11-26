// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_8 } from '#server/db/migrations/migration8.ts'
import { MIGRATION_10 } from '#server/db/migrations/migration10.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'

/**
 * Runs a statement and returns its error message.
 * @param {DatabaseSync} db - Database
 * @param {string} sql - Statement
 * @returns {string | null} - Error message, null when it succeeded
 */
const failure = (db: DatabaseSync, sql: string): string | null => {
  try {
    db.exec(sql)
    return null
  } catch (error) {
    return (error as Error).message
  }
}

describe('migration 10', () => {
  it('follows migration 9 as the tenth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_10)).toBe(9)
  })

  it('adds kev_since and inbox_seen to a version-8 database through 9 and keeps its data', () => {
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_8) + 1))
    db.exec(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, first_seen, last_seen)
       VALUES ('CVE-1', 'img/a', 'High', 1, 't', 't'), ('CVE-2', 'img/a', 'Low', 0, 't', 't')`,
    )
    runMigrations(db)

    const insertSeen = db.prepare(
      'INSERT INTO inbox_seen (username, item_key, seen_at) VALUES (?, ?, ?)',
    )

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT vuln_id, kev, kev_since FROM findings ORDER BY id').all()).toEqual([
      { vuln_id: 'CVE-1', kev: 1, kev_since: null },
      { vuln_id: 'CVE-2', kev: 0, kev_since: null },
    ])
    expect(failure(db, "UPDATE findings SET kev_since = 't2' WHERE vuln_id = 'CVE-1'")).toBeNull()
    expect(failure(db, "UPDATE findings SET kev_since = 't2' WHERE vuln_id = 'CVE-2'")).toMatch(
      /CHECK/,
    )
    expect(() => insertSeen.run('alice', 'kev:1', 't')).not.toThrow()
    expect(() => insertSeen.run('bob', 'kev:1', 't')).not.toThrow()
    expect(() => insertSeen.run('alice', 'kev:1', 't2')).toThrow(/UNIQUE|PRIMARY/)
    expect(() => insertSeen.run('', 'kev:2', 't')).toThrow(/CHECK/)
    expect(() => insertSeen.run('alice', '', 't')).toThrow(/CHECK/)
    expect(() => insertSeen.run('alice', 'k'.repeat(201), 't')).toThrow(/CHECK/)
    expect(() => insertSeen.run('alice', 'kev:3', null)).toThrow(/NOT NULL/)
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE '%kev_since%'")
        .all(),
    ).toEqual([{ name: 'findings_kev_since' }])
  })
})
