// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DatabaseSync } from 'node:sqlite'

import { MIGRATIONS, runMigrations, schemaVersion } from '#server/db/migrations.ts'
import { MIGRATION_8 } from '#server/db/migrations/migration8.ts'
import { MIGRATION_9 } from '#server/db/migrations/migration9.ts'
import { MEMORY_DB } from '#server/db/openDatabase.ts'

const PROPOSAL_COLUMNS = `vuln_id, scope, image_refs, target_key, verdict, justification, summary,
  confidence, evidence, unknowns, refs, evidence_basis, source_access, proposed_by, proposed_via,
  token_id, client_label, basis_decisions, created_at, state, resolution, resolution_note,
  resolved_at, resolved_by`

/**
 * Opens a database at schema version 8 holding a finding, a decision with its event and a token.
 * @returns {DatabaseSync} - Database before migration 9
 */
const versionEightDatabase = (): DatabaseSync => {
  const db = new DatabaseSync(MEMORY_DB)

  runMigrations(db, MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION_8) + 1))
  db.exec(
    `INSERT INTO findings (vuln_id, image_ref, severity, kev, first_seen, last_seen)
     VALUES ('CVE-1', 'img/a', 'High', 0, 't', 't')`,
  )
  db.exec(
    `INSERT INTO decisions (vuln_id, scope, image_ref, status, reason, created_by, created_at,
       updated_at, severity_at_decision, kev_at_decision)
     VALUES ('CVE-1', 'image', 'img/a', 'accepted', 'x', 'u', 't', 't', 'High', 0)`,
  )
  db.exec(
    `INSERT INTO decision_events (decision_id, type, actor, at, payload)
     VALUES (1, 'created', 'u', 't', '{}')`,
  )
  db.exec(
    `INSERT INTO api_tokens (owner, name, scope, token_prefix, token_hash, created_at)
     VALUES ('u', 'laptop', 'propose', 'sieb_x', '${'a'.repeat(64)}', 't')`,
  )

  return db
}

/**
 * Inserts a proposal row with valid defaults.
 * @param {DatabaseSync} db - Migrated database
 * @param {Record<string, string | number | null>} overrides - Column values to replace
 * @returns {void}
 */
const insertProposal = (
  db: DatabaseSync,
  overrides: Record<string, string | number | null> = {},
): void => {
  const row: Record<string, string | number | null> = {
    vuln_id: 'CVE-1',
    scope: 'image',
    image_refs: '["img/a"]',
    target_key: '["img/a"]',
    verdict: 'not_affected',
    justification: 'component_not_present',
    summary: 'Not shipped.',
    confidence: 'high',
    evidence: '[]',
    unknowns: '[]',
    refs: '[]',
    evidence_basis: '["image"]',
    source_access: '[]',
    proposed_by: 'u',
    proposed_via: 'token',
    token_id: 1,
    client_label: 'laptop',
    basis_decisions: '[]',
    created_at: 't',
    state: 'open',
    resolution: null,
    resolution_note: null,
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  }

  db.prepare(
    `INSERT INTO decision_proposals (${PROPOSAL_COLUMNS}) VALUES (${Object.keys(row)
      .map(() => '?')
      .join(', ')})`,
  ).run(...Object.values(row))
}

describe('migration 9', () => {
  it('is the ninth schema step', () => {
    expect(MIGRATIONS[8]).toBe(MIGRATION_9)
  })

  it('adds decision_proposals to a version-8 database and keeps its data', () => {
    const db = versionEightDatabase()

    runMigrations(db)

    expect(schemaVersion(db)).toBe(MIGRATIONS.length)
    expect(db.prepare('SELECT vuln_id, image_ref FROM findings').all()).toEqual([
      { vuln_id: 'CVE-1', image_ref: 'img/a' },
    ])
    expect(db.prepare('SELECT id, status FROM decisions').all()).toEqual([
      { id: 1, status: 'accepted' },
    ])
    expect(db.prepare('SELECT COUNT(*) AS n FROM decision_events').get()?.n).toBe(1)
    expect(db.prepare('SELECT name FROM api_tokens').all()).toEqual([{ name: 'laptop' }])
    expect(() => insertProposal(db)).not.toThrow()
    expect(db.prepare('SELECT state, decision_ids FROM decision_proposals').all()).toEqual([
      { state: 'open', decision_ids: '[]' },
    ])
  })

  it('allows one open proposal per target and proposer', () => {
    const db = versionEightDatabase()

    runMigrations(db)
    insertProposal(db)

    expect(() => insertProposal(db)).toThrow(/UNIQUE/)
    expect(() => insertProposal(db, { proposed_by: 'v' })).not.toThrow()
    expect(() =>
      insertProposal(db, { image_refs: '["img/a","img/b"]', target_key: '["img/a","img/b"]' }),
    ).not.toThrow()

    db.exec(
      `UPDATE decision_proposals SET state = 'superseded', resolution = 'replaced',
         resolved_at = 't', resolved_by = 'u' WHERE id = 1`,
    )

    expect(() => insertProposal(db)).not.toThrow()
  })

  it('checks the structure of a proposal', () => {
    const db = versionEightDatabase()

    runMigrations(db)

    expect(() => insertProposal(db, { verdict: 'accepted' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, { verdict: 'maybe', justification: null })).toThrow(/CHECK/)
    expect(() => insertProposal(db, { evidence_basis: '[]' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, { scope: 'all' })).toThrow(/CHECK/)
    expect(() => insertProposal(db, { summary: 'x'.repeat(1001) })).toThrow(/CHECK/)
    expect(() => insertProposal(db, { proposed_via: 'oauth' })).toThrow(/CHECK/)
    expect(() =>
      insertProposal(db, {
        state: 'rejected',
        resolution: 'rejected',
        resolved_at: 't',
        resolved_by: 'u',
      }),
    ).toThrow(/CHECK/)
    expect(() =>
      insertProposal(db, { scope: 'all', image_refs: null, target_key: '*', token_id: 1 }),
    ).not.toThrow()
  })
})
