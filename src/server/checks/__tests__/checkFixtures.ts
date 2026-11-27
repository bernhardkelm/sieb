import type { DatabaseSync } from 'node:sqlite'

import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { createCheckContext, type CheckContext } from '#server/checks/checkContext.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { buildSnapshot } from '#server/db/__tests__/dbFixtures.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

export const START = new Date('2026-06-01T12:00:00.000Z')
export const PUBLIC_URL = 'https://sieb.example.com'
export const NGINX = 'index.docker.io/library/nginx'
export const REDIS = 'index.docker.io/library/redis'
export const OWN = 'registry.example.com/acme/shop'
export const OTHER = 'registry.example.org/team/tool'
export const DIGEST = `sha256:${'ab'.repeat(32)}`

/** Finding ids of the check fixtures */
export interface CheckFindings {
  nginx: number // public, open, digest and tag
  redis: number // public, open, tag only
  own: number // owner self, private
  other: number // unknown registry
  resolved: number // public, resolved
}

/** Check context over a seeded database with a clock the test moves */
export interface CheckFixture {
  db: DatabaseSync
  context: CheckContext
  findings: CheckFindings
  logs: string[]
  advance: (ms: number) => void
}

/**
 * Returns the id of the finding of an image.
 * @param {DatabaseSync} db - Database
 * @param {string} imageRef - Image ref
 * @returns {number} - Finding id
 */
const findingOf = (db: DatabaseSync, imageRef: string): number =>
  Number(db.prepare('SELECT id FROM findings WHERE image_ref = ?').get(imageRef)?.id)

/**
 * Opens a database with public, private, unknown and resolved findings and a check context
 * whose clock starts at START.
 * @param {{ timeoutSeconds?: number; maxTurns?: number; fetcherSecret?: string | null; vault?: CredentialVault | null }} settings - Check settings, fetcher secret and credential vault to replace
 * @returns {CheckFixture} - Fixture
 */
export const checkFixture = (
  settings: {
    timeoutSeconds?: number
    maxTurns?: number
    fetcherSecret?: string | null
    vault?: CredentialVault | null
  } = {},
): CheckFixture => {
  const db = openDatabase(MEMORY_DB)
  const gone = 'index.docker.io/library/gone'
  const rows = [
    { imageRef: NGINX, imageDigest: DIGEST },
    { imageRef: REDIS, imageTag: '7.4' },
    { imageRef: OWN, owner: 'self' },
    { imageRef: OTHER },
  ]

  applySnapshot(
    db,
    buildSnapshot([...rows, { imageRef: gone }]),
    new Date(START.getTime() - 7200_000),
  )
  applySnapshot(db, buildSnapshot(rows), new Date(START.getTime() - 3600_000))

  let now = START.getTime()
  const logs: string[] = []
  const context = createCheckContext({
    db,
    clock: () => new Date(now),
    log: (line) => logs.push(line),
    publicRegistries: DEFAULT_PUBLIC_REGISTRIES,
    publicUrl: PUBLIC_URL,
    config: {
      timeoutSeconds: settings.timeoutSeconds ?? 1200,
      maxTurns: settings.maxTurns ?? 60,
      fetcherSecret: settings.fetcherSecret ?? null,
    },
    vault: settings.vault ?? null,
  })

  return {
    db,
    context,
    logs,
    findings: {
      nginx: findingOf(db, NGINX),
      redis: findingOf(db, REDIS),
      own: findingOf(db, OWN),
      other: findingOf(db, OTHER),
      resolved: findingOf(db, gone),
    },
    advance: (ms) => {
      now += ms
    },
  }
}

/**
 * Inserts a proposal row filed with a token, the shape propose_decision writes.
 * @param {DatabaseSync} db - Database
 * @param {{ tokenId: number; proposedBy: string; vulnId?: string; imageRef?: string }} proposal - Token, proposer and target
 * @returns {number} - Proposal id
 */
export const insertTokenProposal = (
  db: DatabaseSync,
  {
    tokenId,
    proposedBy,
    vulnId = 'CVE-2025-1000',
    imageRef = NGINX,
  }: {
    tokenId: number
    proposedBy: string
    vulnId?: string
    imageRef?: string
  },
): number => {
  const refs = JSON.stringify([imageRef])

  return Number(
    db
      .prepare(
        `INSERT INTO decision_proposals (vuln_id, scope, image_refs, target_key, verdict, summary,
           confidence, evidence, unknowns, refs, evidence_basis, source_access, proposed_by,
           proposed_via, token_id, client_label, basis_decisions, created_at)
         VALUES (?, 'image', ?, ?, 'needs_patch', 'Reachable.', 'high', '[]', '[]', '[]',
           '["image"]', '[]', ?, 'token', ?, 'claude-code', '[]', ?)`,
      )
      .run(vulnId, refs, refs, proposedBy, tokenId, START.toISOString()).lastInsertRowid,
  )
}
