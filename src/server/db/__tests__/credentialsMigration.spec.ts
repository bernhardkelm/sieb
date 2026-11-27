// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_19 } from '#server/db/migrations/migration19.ts'
import { MIGRATION_20 } from '#server/db/migrations/migration20.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'

const ROW: Record<string, string | Buffer | null> = {
  provider: 'gitlab',
  label: 'Example',
  uses: '["registry","git"]',
  registry_host: 'registry.example.com',
  git_host: 'gitlab.example.com',
  path_prefix: 'acme',
  repo_mapping: null,
  username: 'bot',
  secret_ciphertext: Buffer.alloc(40, 1),
  secret_nonce: Buffer.alloc(12, 2),
  key_id: 'abcdef0123456789',
  created_by: 'alice',
  created_at: 't',
  updated_at: 't',
}

/**
 * Inserts a credential row with column overrides.
 * @param {DatabaseSync} db - Migrated database
 * @param {Record<string, string | Buffer | null>} overrides - Column values to replace
 * @returns {void}
 */
const insertCredential = (
  db: DatabaseSync,
  overrides: Record<string, string | Buffer | null> = {},
): void => {
  const row = { ...ROW, ...overrides }

  db.prepare(
    `INSERT INTO access_credentials (${Object.keys(row).join(', ')})
     VALUES (${Object.keys(row)
       .map(() => '?')
       .join(', ')})`,
  ).run(...Object.values(row))
}

describe('migration 20', () => {
  it('follows migration 19 as the twentieth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_20)).toBe(19)
  })

  it('adds access_credentials and checks.source to a version-19 database and keeps its checks', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_19) + 1))
    db.exec(
      `INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, state, created_at, finished_at)
       VALUES (1, 'CVE-1', 'img/a', 'alice', 'cancelled', 't', 't')`,
    )
    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT image_ref, state, source FROM checks').all()).toEqual([
      { image_ref: 'img/a', state: 'cancelled', source: null },
    ])
    expect(() => insertCredential(db)).not.toThrow()
    expect(db.prepare('SELECT last_used_at, last_test FROM access_credentials').get()).toEqual({
      last_used_at: null,
      last_test: null,
    })
  })

  it('checks provider, uses, hosts, the sealed secret and the JSON columns', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)

    expect(() => insertCredential(db, { provider: 'bitbucket' })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { uses: '[]' })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { uses: '{}' })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { registry_host: null, git_host: null })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { label: '' })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { secret_nonce: Buffer.alloc(8) })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { secret_ciphertext: 'plain text secret value' })).toThrow(
      /CHECK/,
    )
    expect(() => insertCredential(db, { repo_mapping: '[1]' })).toThrow(/CHECK/)
    expect(() => insertCredential(db, { path_prefix: 'a'.repeat(201) })).toThrow(/CHECK/)
    expect(() =>
      db.exec(`INSERT INTO checks (finding_id, vuln_id, image_ref, requested_by, state, created_at, finished_at, source)
               VALUES (1, 'CVE-1', 'img/a', 'alice', 'cancelled', 't', 't', '"x"')`),
    ).toThrow(/CHECK/)
  })
})
