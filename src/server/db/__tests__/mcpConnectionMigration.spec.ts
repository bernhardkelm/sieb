// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { recordMcpConnection, mcpLastSeenAt } from '#server/db/mcpConnectionRepository.ts'
import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_10 } from '#server/db/migrations/migration10.ts'
import { MIGRATION_11 } from '#server/db/migrations/migration11.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'

describe('migration 11', () => {
  it('follows migration 10 as the eleventh step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_11)).toBe(10)
  })

  it('adds mcp_connections to a version-10 database and keeps its data', () => {
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_10) + 1))
    db.exec("INSERT INTO inbox_seen (username, item_key, seen_at) VALUES ('alice', 'kev:1', 't')")
    runMigrations(db)

    const insert = db.prepare(
      'INSERT INTO mcp_connections (username, via, last_seen_at) VALUES (?, ?, ?)',
    )

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT username, item_key FROM inbox_seen').all()).toEqual([
      { username: 'alice', item_key: 'kev:1' },
    ])
    expect(() => insert.run('alice', 'token', 't')).not.toThrow()
    expect(() => insert.run('alice', 'oauth', 't')).not.toThrow()
    expect(() => insert.run('alice', 'oauth', 't2')).toThrow(/UNIQUE|PRIMARY/)
    expect(() => insert.run('alice', 'header', 't')).toThrow(/CHECK/)
    expect(() => insert.run('', 'token', 't')).toThrow(/CHECK/)
    expect(() => insert.run('bob', 'token', null)).toThrow(/NOT NULL/)
  })

  it('keeps the latest time per user and kind', () => {
    const db = new DatabaseSync(MEMORY_DB)
    runMigrations(db)
    const alice = { username: 'alice', via: 'oauth' } as const

    recordMcpConnection(db, alice, new Date('2026-06-01T12:00:00.000Z'))
    recordMcpConnection(db, alice, new Date('2026-05-01T12:00:00.000Z'))
    recordMcpConnection(db, { username: 'alice', via: 'token' }, new Date('2026-04-01T00:00:00Z'))

    expect(mcpLastSeenAt(db, 'alice', 'oauth')).toBe('2026-06-01T12:00:00.000Z')
    expect(mcpLastSeenAt(db, 'alice', 'token')).toBe('2026-04-01T00:00:00.000Z')
    expect(mcpLastSeenAt(db, 'bob', 'oauth')).toBeNull()

    recordMcpConnection(db, alice, new Date('2026-06-02T12:00:00.000Z'))

    expect(mcpLastSeenAt(db, 'alice', 'oauth')).toBe('2026-06-02T12:00:00.000Z')
  })
})
