// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_18 } from '#server/db/migrations/migration18.ts'
import { MIGRATION_19 } from '#server/db/migrations/migration19.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'
import { accessColumn } from '#server/db/__tests__/proposalAccessColumn.ts'
import { getProposal } from '#server/db/proposalRepository.ts'

/**
 * Inserts a minimal open proposal of alice for one image.
 * @param {DatabaseSync} db - Migrated database
 * @param {string} vulnId - Vulnerability, distinct per row of one test
 * @param {Record<string, string | null>} extra - Further columns such as related_findings
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
       confidence, evidence, unknowns, refs, evidence_basis, ${accessColumn(db)}, proposed_by,
       proposed_via, token_id, client_label, basis_decisions, created_at${columns.map((c) => `, ${c}`).join('')})
     VALUES (?, 'image', '["img/a"]', '["img/a"]', 'needs_patch', 'Reachable.', 'high',
       '[]', '[]', '[]', '["image"]', '[]', 'alice', 'token', 1, 'laptop', '[]', 't'${columns.map(() => ', ?').join('')})`,
    )
    .run(vulnId, ...Object.values(extra))

  return Number(lastInsertRowid)
}

describe('migration 19', () => {
  it('follows migration 18 as the nineteenth step', () => {
    expect(MIGRATIONS.indexOf(MIGRATION_19)).toBe(18)
  })

  it('adds related findings to a version-18 database and keeps its proposals', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_18) + 1))
    const id = insertProposal(db, 'CVE-1')
    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(
      db.prepare('SELECT related_findings, related_reason FROM decision_proposals').get(),
    ).toEqual({ related_findings: '[]', related_reason: null })
    expect(getProposal(db, id)).toMatchObject({
      summary: 'Reachable.',
      relatedFindings: [],
      relatedReason: null,
    })
  })

  it('checks the JSON list, its length and the reason length', () => {
    const db = new DatabaseSync(MEMORY_DB)

    runMigrations(db)
    const list = (count: number): string =>
      JSON.stringify(Array.from({ length: count }, (_, index) => ({ findingId: index + 1 })))

    expect(() => insertProposal(db, 'CVE-1', { related_findings: list(50) })).not.toThrow()
    expect(() => insertProposal(db, 'CVE-2', { related_findings: list(51) })).toThrow(/CHECK/)
    expect(() => insertProposal(db, 'CVE-3', { related_findings: '{}' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, 'CVE-4', { related_findings: 'nope' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, 'CVE-5', { related_reason: '' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, 'CVE-6', { related_reason: 'x'.repeat(1001) })).toThrow(/CHECK/)
  })
})
