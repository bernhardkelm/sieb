// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_12 } from '#server/db/migrations/migration12.ts'
import { MIGRATION_13 } from '#server/db/migrations/migration13.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'

/**
 * Inserts a check row, queued by default.
 * @param {DatabaseSync} db - Migrated database
 * @param {Record<string, string | number | null>} overrides - Column values to replace
 * @returns {void}
 */
const insertCheckRow = (
  db: DatabaseSync,
  overrides: Record<string, string | number | null> = {},
): void => {
  const row: Record<string, string | number | null> = {
    finding_id: 1,
    vuln_id: 'CVE-1',
    image_ref: 'img/a',
    requested_by: 'alice',
    state: 'queued',
    created_at: 't',
    ...overrides,
  }

  db.prepare(
    `INSERT INTO checks (${Object.keys(row).join(', ')})
     VALUES (${Object.keys(row)
       .map(() => '?')
       .join(', ')})`,
  ).run(...Object.values(row))
}

const RUNNING = { state: 'running', phase: 'preparing', started_at: 't', heartbeat_at: 't' }

describe('migration 13', () => {
  it('follows migration 12 as the thirteenth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_13)).toBe(12)
  })

  it('adds checks to a version-12 database and keeps its data', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_12) + 1))
    db.exec(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, first_seen, last_seen)
       VALUES ('CVE-1', 'img/a', 'High', 0, 't', 't')`,
    )
    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT vuln_id FROM findings').all()).toEqual([{ vuln_id: 'CVE-1' }])
    expect(() => insertCheckRow(db)).not.toThrow()
    expect(db.prepare('SELECT state, phase, finished_at FROM checks').get()).toEqual({
      state: 'queued',
      phase: null,
      finished_at: null,
    })
  })

  it('checks state, phase and the life cycle columns', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)

    expect(() => insertCheckRow(db, { state: 'paused' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { ...RUNNING, phase: 'thinking' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { state: 'running' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { state: 'done', started_at: 't' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { state: 'queued', finished_at: 't' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { error: 'x' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { usage: '[1]' })).toThrow(/CHECK/)
    expect(() => insertCheckRow(db, { reply: 'x'.repeat(4001) })).toThrow(/CHECK/)
    expect(() =>
      insertCheckRow(db, { state: 'failed', finished_at: 't', error: 'Not startable.' }),
    ).not.toThrow()
    expect(() => insertCheckRow(db, { state: 'cancelled', finished_at: 't' })).not.toThrow()
  })

  it('allows one open check per finding and one running check overall', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)
    insertCheckRow(db, RUNNING)

    expect(() => insertCheckRow(db)).toThrow(/UNIQUE/)
    expect(() => insertCheckRow(db, { ...RUNNING, finding_id: 2 })).toThrow(/UNIQUE/)
    expect(() => insertCheckRow(db, { finding_id: 2 })).not.toThrow()
    expect(() => insertCheckRow(db, { state: 'cancelled', finished_at: 't' })).not.toThrow()
  })
})
