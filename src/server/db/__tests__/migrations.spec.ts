// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { listDecisions } from '#server/db/decisionRepository.ts'
import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_1 } from '#server/db/migrations/migration1.ts'
import { MIGRATION_4 } from '#server/db/migrations/migration4.ts'
import { MIGRATION_5 } from '#server/db/migrations/migration5.ts'
import { MIGRATION_6 } from '#server/db/migrations/migration6.ts'
import { MIGRATION_7 } from '#server/db/migrations/migration7.ts'
import { MIGRATION_8 } from '#server/db/migrations/migration8.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'

describe('openDatabase', () => {
  it('applies all migrations with foreign keys on', () => {
    const db = openDatabase(MEMORY_DB)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(tables).toEqual([
      'api_tokens',
      'decision_baselines',
      'decision_events',
      'decision_proposals',
      'decisions',
      'finding_instances',
      'findings',
      'inbox_seen',
      'kev_catalog',
      'kev_feed',
      'mcp_connections',
      'sessions',
      'stats_snapshots',
      'sync_runs',
    ])
    expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1)
    expect(
      db
        .prepare('PRAGMA table_info(decisions)')
        .all()
        .some((column) => column.name === 'justification'),
    ).toBe(true)
  })

  it('keeps decision_events append-only and one current decision per scope', () => {
    const db = openDatabase(MEMORY_DB)
    const insert = db.prepare(
      `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, created_by, created_at,
         updated_at, severity_at_decision, kev_at_decision)
       VALUES ('CVE-1', 'all', NULL, 'accepted', 'x', 'u', 't', 't', 'High', 0)`,
    )

    insert.run()
    db.prepare(
      "INSERT INTO decision_events (decision_id, type, actor, at, payload) VALUES (1, 'created', 'u', 't', '{}')",
    ).run()

    expect(() => insert.run()).toThrow(/UNIQUE/)
    expect(() => db.exec("UPDATE decision_events SET actor = 'x'")).toThrow(/append-only/)
    expect(() => db.exec('DELETE FROM decision_events')).toThrow(/append-only/)
  })

  it('seeds baselines for the images current decisions govern from the old snapshot', () => {
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, [MIGRATION_1])
    const finding = db.prepare(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, exposure, owner, first_seen, last_seen)
       VALUES ('CVE-1', ?, ?, 0, 'internal', 'self', 't', 't')`,
    )
    const decision = db.prepare(
      `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, created_by, created_at,
         updated_at, severity_at_decision, kev_at_decision, revoked_at)
       VALUES ('CVE-1', ?, ?, 'accepted', 'x', 'u', 't', 't1', ?, 0, ?)`,
    )

    finding.run('img/a', 'Critical')
    finding.run('img/b', 'Low')
    finding.run('img/c', 'Low')
    decision.run('image', 'img/a', 'Critical', null)
    decision.run('all', null, 'Critical', null)
    decision.run('image', 'img/c', 'Low', 't0')
    runMigrations(db)

    const baselines = listDecisions(db).map((stored) => [
      stored.id,
      stored.reopenedAt,
      stored.baselines.map((baseline) => [
        baseline.imageRef,
        baseline.severity,
        baseline.recordedAt,
      ]),
    ])

    expect(baselines).toEqual([
      [3, null, []],
      [
        2,
        null,
        [
          ['img/b', 'Critical', 't1'],
          ['img/c', 'Critical', 't1'],
        ],
      ],
      [1, null, [['img/a', 'Critical', 't1']]],
    ])
  })

  it('makes exposure and owner optional and keeps findings, ids and instances', () => {
    const db = new DatabaseSync(MEMORY_DB)
    db.exec('PRAGMA foreign_keys = ON')
    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_4)))
    db.exec(
      `INSERT INTO findings (id, vuln_id, image_ref, severity, kev, exposure, owner, first_seen, last_seen)
       VALUES (7, 'CVE-1', 'img/a', 'High', 1, 'public', 'self', 't', 't')`,
    )
    db.exec(
      `INSERT INTO finding_instances (finding_id, natural_key, namespace, resource_kind, resource_name,
         first_seen, last_seen)
       VALUES (7, 'k', 'ns', 'ReplicaSet', 'web', 't', 't')`,
    )
    runMigrations(db)

    const insert = db.prepare(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, exposure, owner, first_seen, last_seen)
       VALUES ('CVE-2', ?, 'Low', 0, ?, ?, 't', 't')`,
    )

    expect(db.prepare('SELECT id, exposure, owner, kev FROM findings').all()).toEqual([
      { id: 7, exposure: 'public', owner: 'self', kev: 1 },
    ])
    expect(db.prepare('SELECT finding_id FROM finding_instances').all()).toEqual([
      { finding_id: 7 },
    ])
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(() => insert.run('img/b', null, null)).not.toThrow()
    expect(() => insert.run('img/c', 'internal', 'platform team')).not.toThrow()
    expect(() => insert.run('img/d', 'unknown', null)).toThrow(/CHECK/)

    db.exec('DELETE FROM findings WHERE id = 7')

    expect(db.prepare('SELECT COUNT(*) AS n FROM finding_instances').get()?.n).toBe(0)
  })

  it('adds the KEV catalog and a single fetch state row to an existing database', () => {
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_5)))
    db.exec(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, exposure, owner, first_seen, last_seen)
       VALUES ('CVE-1', 'img/a', 'High', 1, NULL, NULL, 't', 't')`,
    )
    runMigrations(db)

    const insert = db.prepare(
      'INSERT INTO kev_catalog (cve_id, date_added, known_ransomware) VALUES (?, ?, ?)',
    )

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT kev FROM findings').all()).toEqual([{ kev: 1 }])
    expect(db.prepare('SELECT id, last_success_at, entry_count FROM kev_feed').all()).toEqual([
      { id: 1, last_success_at: null, entry_count: 0 },
    ])
    expect(() => insert.run('CVE-2024-1', '2024-01-02', 1)).not.toThrow()
    expect(() => insert.run('CVE-2024-2', '2024-01-02', null)).not.toThrow()
    expect(() => insert.run('CVE-2024-3', '2024-01-02', 2)).toThrow(/CHECK/)
    expect(() => insert.run('CVE-2024-1', '2024-01-02', 0)).toThrow(/UNIQUE|PRIMARY/)
    expect(() => db.exec('INSERT INTO kev_feed (id) VALUES (2)')).toThrow(/CHECK/)
  })

  it('adds an empty justification to existing decisions, only for not_affected', () => {
    const schema5 = MIGRATIONS.slice(0, 5)
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, schema5)
    const insert = db.prepare(
      `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, created_by, created_at,
         updated_at, severity_at_decision, kev_at_decision)
       VALUES (?, 'all', NULL, ?, 'x', 'u', 't', 't', 'High', 0)`,
    )

    insert.run('CVE-1', 'not_affected')
    insert.run('CVE-2', 'accepted')
    runMigrations(db, [...schema5, MIGRATION_6])

    /**
     * Runs a statement and returns its error message.
     * @param {string} sql - Statement
     * @returns {string | null} - Error message, null when it succeeded
     */
    const failure = (sql: string): string | null => {
      try {
        db.exec(sql)
        return null
      } catch (error) {
        return (error as Error).message
      }
    }

    expect(schemaVersion(db)).toBe(6)
    expect(db.prepare('SELECT id, status, justification FROM decisions').all()).toEqual([
      { id: 1, status: 'not_affected', justification: null },
      { id: 2, status: 'accepted', justification: null },
    ])
    expect(
      failure("UPDATE decisions SET justification = 'component_not_present' WHERE id = 1"),
    ).toBeNull()
    expect(failure("UPDATE decisions SET justification = 'false_positive' WHERE id = 1")).toMatch(
      /CHECK/,
    )
    expect(
      failure("UPDATE decisions SET justification = 'component_not_present' WHERE id = 2"),
    ).toMatch(/CHECK/)
    expect(failure("UPDATE decisions SET status = 'accepted' WHERE id = 1")).toMatch(/CHECK/)
    expect(
      failure("UPDATE decisions SET status = 'accepted', justification = NULL WHERE id = 1"),
    ).toBeNull()
  })

  it('adds api_tokens to a version-6 database and keeps its data', () => {
    const schema6 = MIGRATIONS.slice(0, 6)
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, schema6)
    db.exec(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, exposure, owner, first_seen, last_seen)
       VALUES ('CVE-1', 'img/a', 'High', 1, NULL, NULL, 't', 't')`,
    )
    db.exec(
      `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, created_by, created_at,
         updated_at, severity_at_decision, kev_at_decision, justification)
       VALUES ('CVE-1', 'all', NULL, 'not_affected', 'x', 'u', 't', 't', 'High', 1,
         'component_not_present')`,
    )
    runMigrations(db, [...schema6, MIGRATION_7])

    const hash = 'a'.repeat(64)
    const insert = db.prepare(
      `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at,
         revoked_at, revoked_by)
       VALUES (?, ?, ?, 'sieb_abcd', ?, 't', ?, ?)`,
    )

    expect(schemaVersion(db)).toBe(7)
    expect(db.prepare('SELECT vuln_id FROM findings').all()).toEqual([{ vuln_id: 'CVE-1' }])
    expect(db.prepare('SELECT status, justification FROM decisions').all()).toEqual([
      { status: 'not_affected', justification: 'component_not_present' },
    ])
    expect(() => insert.run('alice', 'laptop', 'read', hash, null, null)).not.toThrow()
    expect(() => insert.run('alice', 'ci', 'propose', 'b'.repeat(64), 't', 'alice')).not.toThrow()
    expect(() => insert.run('bob', 'dup', 'read', hash, null, null)).toThrow(/UNIQUE/)
    expect(() => insert.run('bob', 'x', 'write', 'c'.repeat(64), null, null)).toThrow(/CHECK/)
    expect(() => insert.run('bob', '', 'read', 'd'.repeat(64), null, null)).toThrow(/CHECK/)
    expect(() => insert.run('bob', 'x'.repeat(65), 'read', 'e'.repeat(64), null, null)).toThrow(
      /CHECK/,
    )
    expect(() => insert.run('bob', 'x', 'read', 'short', null, null)).toThrow(/CHECK/)
    expect(() => insert.run('bob', 'x', 'read', 'f'.repeat(64), 't', null)).toThrow(/CHECK/)
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'api_tokens'")
        .all()
        .map((row) => row.name),
    ).toContain('api_tokens_owner')
  })

  it('adds sessions to a version-7 database and keeps its data', () => {
    const schema7 = MIGRATIONS.slice(0, 7)
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, schema7)
    db.exec(
      `INSERT INTO findings (vuln_id, image_ref, severity, kev, exposure, owner, first_seen, last_seen)
       VALUES ('CVE-1', 'img/a', 'High', 1, NULL, NULL, 't', 't')`,
    )
    db.exec(
      `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at)
       VALUES ('alice', 'laptop', 'read', 'sieb_abcd', '${'a'.repeat(64)}', 't')`,
    )
    runMigrations(db, [...schema7, MIGRATION_8])

    const insert = db.prepare(
      `INSERT INTO sessions (id_hash, username, groups, created_at, last_seen_at, expires_at, id_token)
       VALUES (?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', ?, ?)`,
    )
    const later = '2026-01-01T12:00:00.000Z'

    expect(schemaVersion(db)).toBe(8)
    expect(db.prepare('SELECT vuln_id FROM findings').all()).toEqual([{ vuln_id: 'CVE-1' }])
    expect(db.prepare('SELECT owner FROM api_tokens').all()).toEqual([{ owner: 'alice' }])
    expect(() => insert.run('a'.repeat(64), 'alice', '["sieb-users"]', later, 'jwt')).not.toThrow()
    expect(() => insert.run('a'.repeat(64), 'bob', '[]', later, 'jwt')).toThrow(/UNIQUE|PRIMARY/)
    expect(() => insert.run('short', 'bob', '[]', later, 'jwt')).toThrow(/CHECK/)
    expect(() => insert.run('b'.repeat(64), '', '[]', later, 'jwt')).toThrow(/CHECK/)
    expect(() => insert.run('c'.repeat(64), 'bob', '{}', later, 'jwt')).toThrow(/CHECK/)
    expect(() => insert.run('d'.repeat(64), 'bob', 'nope', later, 'jwt')).toThrow(/CHECK/)
    expect(() =>
      insert.run('e'.repeat(64), 'bob', '[]', '2025-12-31T00:00:00.000Z', 'jwt'),
    ).toThrow(/CHECK/)
    expect(() => insert.run('f'.repeat(64), 'bob', '[]', later, '')).toThrow(/CHECK/)
    expect(() => insert.run('0'.repeat(64), 'bob', '[]', later, null)).toThrow(/NOT NULL/)
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sessions'")
        .all()
        .map((row) => row.name),
    ).toContain('sessions_expires_at')
  })
})
