// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_20 } from '#server/db/migrations/migration20.ts'
import { MIGRATION_21 } from '#server/db/migrations/migration21.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { getProposal } from '#server/db/proposalRepository.ts'

const SOURCE_ACCESS = JSON.stringify([
  { imageRef: 'registry.example.com/acme/shop', access: 'private' },
  { imageRef: 'docker.io/library/nginx', access: 'public' },
  { imageRef: 'registry.example.org/team/tool', access: 'unknown' },
])
const COMMIT = 'abcdef0123456789abcdef0123456789abcdef01'

/**
 * Opens a database at schema version 20 with one proposal and two ended checks with source.
 * @returns {DatabaseSync} - Database before migration 21
 */
const versionTwentyDatabase = (): DatabaseSync => {
  const db = new DatabaseSync(MEMORY_DB)

  runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_20) + 1))
  db.prepare(
    `INSERT INTO decision_proposals (id, vuln_id, scope, image_refs, target_key, verdict, summary,
       confidence, evidence, unknowns, refs, evidence_basis, source_access, proposed_by,
       proposed_via, token_id, client_label, basis_decisions, created_at)
     VALUES (4, 'CVE-1', 'image', '["img/a"]', '["img/a"]', 'needs_patch', 'Reachable.', 'high',
       '[]', '[]', '[]', '["image"]', ?, 'alice', 'token', 1, 'laptop', '[]', 't')`,
  ).run(SOURCE_ACCESS)
  db.prepare(
    `INSERT INTO checks (id, finding_id, vuln_id, image_ref, requested_by, state, created_at,
       started_at, finished_at, source)
     VALUES (1, 1, 'CVE-1', 'img/a', 'alice', 'done', 't', 't', 't', ?),
            (2, 1, 'CVE-1', 'img/a', 'alice', 'done', 't', 't', 't', ?),
            (3, 1, 'CVE-1', 'img/a', 'alice', 'done', 't', 't', 't', NULL)`,
  ).run(
    JSON.stringify({
      repoUrl: 'https://gitlab.example.com/acme/shop.git',
      revision: COMMIT,
      fromLabel: true,
    }),
    JSON.stringify({
      repoUrl: 'https://gitlab.example.com/acme/shop.git',
      revision: null,
      fromLabel: false,
    }),
  )

  return db
}

describe('migration 21', () => {
  it('follows migration 20 as the twenty-first step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_21)).toBe(20)
  })

  it('turns the source access snapshot into visibility and ownership', () => {
    const db = versionTwentyDatabase()

    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(getProposal(db, 4)?.imageAccess).toEqual([
      { imageRef: 'registry.example.com/acme/shop', imageVisibility: 'unknown', ownership: 'own' },
      { imageRef: 'docker.io/library/nginx', imageVisibility: 'public', ownership: 'third_party' },
      {
        imageRef: 'registry.example.org/team/tool',
        imageVisibility: 'unknown',
        ownership: 'third_party',
      },
    ])
  })

  it('adds refKind and ref to the stored sources', () => {
    const db = versionTwentyDatabase()

    runMigrations(db)

    const sources = (
      db.prepare('SELECT source FROM checks ORDER BY id').all() as { source: string | null }[]
    ).map((row) => (row.source === null ? null : JSON.parse(row.source)))

    expect(sources).toEqual([
      {
        repoUrl: 'https://gitlab.example.com/acme/shop.git',
        revision: COMMIT,
        fromLabel: true,
        refKind: 'label',
        ref: null,
      },
      {
        repoUrl: 'https://gitlab.example.com/acme/shop.git',
        revision: null,
        fromLabel: false,
        refKind: 'default_branch',
        ref: null,
      },
      null,
    ])
  })

  it('checks the rows of image_pull_probes', () => {
    const db = new DatabaseSync(MEMORY_DB)
    const insert = (imageRef: string, result: string, reason: string | null): void => {
      db.prepare(
        'INSERT INTO image_pull_probes (image_ref, result, reason, probed_at) VALUES (?, ?, ?, ?)',
      ).run(imageRef, result, reason, 't')
    }

    runMigrations(db)
    insert('ghcr.io/acme/app', 'public', null)
    insert('ghcr.io/acme/api', 'failed', 'timeout')

    expect(() => insert('ghcr.io/acme/app', 'restricted', null)).toThrow(/UNIQUE|PRIMARY/)
    expect(() => insert('ghcr.io/acme/x', 'private', null)).toThrow(/CHECK/)
    expect(() => insert('', 'public', null)).toThrow(/CHECK/)
    expect(() => insert('ghcr.io/acme/y', 'failed', '')).toThrow(/CHECK/)
    expect(() => insert('ghcr.io/acme/z', 'failed', 'x'.repeat(101))).toThrow(/CHECK/)
  })
})
