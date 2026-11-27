// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_13 } from '#server/db/migrations/migration13.ts'
import { MIGRATION_14 } from '#server/db/migrations/migration14.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { accessColumn } from '#server/db/__tests__/proposalAccessColumn.ts'

/**
 * Inserts a minimal open proposal of alice for nginx.
 * @param {DatabaseSync} db - Migrated database
 * @param {number} tokenId - Token it was filed with
 * @param {Record<string, number | null>} extra - Further columns such as check_id
 * @returns {void}
 */
const insertProposal = (
  db: DatabaseSync,
  tokenId: number,
  extra: Record<string, number | null> = {},
): void => {
  const columns = Object.keys(extra)

  db.prepare(
    `INSERT INTO decision_proposals (vuln_id, scope, image_refs, target_key, verdict, summary,
       confidence, evidence, unknowns, refs, evidence_basis, ${accessColumn(db)}, proposed_by,
       proposed_via, token_id, client_label, basis_decisions, created_at${columns.map((c) => `, ${c}`).join('')})
     VALUES ('CVE-1', 'image', '["img/a"]', '["img/a"]', 'needs_patch', 'Reachable.', 'high',
       '[]', '[]', '[]', '["image"]', '[]', 'alice', 'token', ?, 'laptop', '[]', 't'${columns.map(() => ', ?').join('')})`,
  ).run(tokenId, ...Object.values(extra))
}

const HASH = 'a'.repeat(63)

describe('migration 14', () => {
  it('follows migration 13 as the fourteenth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_14)).toBe(13)
  })

  it('marks the token and the proposals of a running check from checks.token_id', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_13) + 1))
    db.exec(
      `INSERT INTO api_tokens (id, owner, name, scope, token_prefix, token_hash, created_at, expires_at)
       VALUES (7, 'alice', 'Auto-check #1', 'propose', 'p', '${HASH}7', 't', 'u'),
              (8, 'alice', 'laptop', 'read', 'p', '${HASH}8', 't', 'u');
       INSERT INTO checks (id, finding_id, vuln_id, image_ref, requested_by, state, phase,
         created_at, started_at, heartbeat_at, token_id)
       VALUES (1, 1, 'CVE-1', 'img/a', 'alice', 'running', 'investigating', 't', 't', 't', 7);`,
    )
    insertProposal(db, 7)
    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT id, check_id FROM api_tokens ORDER BY id').all()).toEqual([
      { id: 7, check_id: 1 },
      { id: 8, check_id: null },
    ])
    expect(db.prepare('SELECT check_id FROM decision_proposals').get()).toEqual({ check_id: 1 })
    expect(db.prepare('SELECT pulled_digest FROM checks').get()).toEqual({ pulled_digest: null })
  })

  it('keeps one open proposal per target and proposer, apart from each check', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)
    insertProposal(db, 8)

    expect(() => insertProposal(db, 8)).toThrow(/UNIQUE/)
    expect(() => insertProposal(db, 7, { check_id: 1 })).not.toThrow()
    expect(() => insertProposal(db, 7, { check_id: 1 })).toThrow(/UNIQUE/)
    expect(() => insertProposal(db, 9, { check_id: 2 })).not.toThrow()
  })

  it('allows one token per check', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)
    db.exec(
      `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at, expires_at, check_id)
       VALUES ('alice', 'Auto-check #1', 'propose', 'p', '${HASH}1', 't', 'u', 1)`,
    )

    expect(() =>
      db.exec(
        `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at, expires_at, check_id)
         VALUES ('alice', 'Auto-check #1', 'propose', 'p', '${HASH}2', 't', 'u', 1)`,
      ),
    ).toThrow(/UNIQUE/)
  })
})
