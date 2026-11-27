// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_14 } from '#server/db/migrations/migration14.ts'
import { MIGRATION_15 } from '#server/db/migrations/migration15.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { getProposal } from '#server/db/proposalRepository.ts'

/**
 * Inserts a minimal open proposal of alice for nginx.
 * @param {DatabaseSync} db - Migrated database
 * @param {string} vulnId - Vulnerability, distinct per row of one test
 * @param {Record<string, string | null>} extra - Further columns such as client_kind
 * @returns {number} - Proposal id
 */
const insertProposal = (
  db: DatabaseSync,
  vulnId: string,
  extra: Record<string, string | null> = {},
): number => {
  const columns = Object.keys(extra)
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO decision_proposals (vuln_id, scope, image_refs, target_key, verdict, summary,
       confidence, evidence, unknowns, refs, evidence_basis, source_access, proposed_by,
       proposed_via, token_id, client_label, basis_decisions, created_at${columns.map((c) => `, ${c}`).join('')})
     VALUES (?, 'image', '["img/a"]', '["img/a"]', 'needs_patch', 'Reachable.', 'high',
       '[]', '[]', '[]', '["image"]', '[]', 'alice', 'token', 1, 'laptop', '[]', 't'${columns.map(() => ', ?').join('')})`,
    )
    .run(vulnId, ...Object.values(extra))

  return Number(lastInsertRowid)
}

describe('migration 15', () => {
  it('follows migration 14 as the fifteenth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_15)).toBe(14)
  })

  it('adds client_kind and keeps existing proposals without one', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_14) + 1))
    const id = insertProposal(db, 'CVE-1')
    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT client_kind FROM decision_proposals').get()).toEqual({
      client_kind: null,
    })
    expect(getProposal(db, id)).toMatchObject({ clientLabel: 'laptop', clientKind: null })
  })

  it('reads a known kind and treats an unknown one as absent', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)
    const known = insertProposal(db, 'CVE-1', { client_kind: 'claude_app' })
    const unknown = insertProposal(db, 'CVE-2', { client_kind: 'claude_code_jetbrains' })

    expect(getProposal(db, known)?.clientKind).toBe('claude_app')
    expect(getProposal(db, unknown)?.clientKind).toBeNull()
    expect(() => insertProposal(db, 'CVE-3', { client_kind: '' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, 'CVE-4', { client_kind: 'x'.repeat(41) })).toThrow(/CHECK/)
  })
})
