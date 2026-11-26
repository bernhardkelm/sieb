import type { DatabaseSync } from 'node:sqlite'

import type { SourceInstance, SourceSnapshot } from '#core/sourceSnapshot.ts'
import { buildSourceInstance } from '#core/__tests__/coreBuilders.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

export const NGINX = 'index.docker.io/library/nginx'
export const REDIS = 'index.docker.io/library/redis'

/**
 * Builds a snapshot from source rows.
 * @param {readonly Partial<SourceInstance>[]} rows - Row overrides
 * @param {string[] | null} kevIds - KEV listed vuln ids, null for a snapshot without KEV list
 * @returns {SourceSnapshot} - Snapshot
 */
export const buildSnapshot = (
  rows: readonly Partial<SourceInstance>[],
  kevIds: string[] | null = [],
): SourceSnapshot => ({
  instances: rows.map((row) => buildSourceInstance(row)),
  kevIds,
  fetchedAt: '2026-06-01T00:00:00.000Z',
})

/**
 * Opens an in-memory database with two findings of CVE-2025-1000 (nginx, redis) and one of
 * CVE-2025-2000 (nginx).
 * @param {Date} now - Sync time
 * @returns {DatabaseSync} - Seeded database
 */
export const seededDatabase = (now: Date): DatabaseSync => {
  const db = openDatabase(MEMORY_DB)

  applySnapshot(
    db,
    buildSnapshot([
      { imageRef: NGINX, severity: 'High' },
      { imageRef: NGINX, package: 'libcrypto3', severity: 'High' },
      { imageRef: REDIS, severity: 'Medium', resourceName: 'cache-0', container: 'redis' },
      { vulnId: 'CVE-2025-2000', imageRef: NGINX, severity: 'Low' },
    ]),
    now,
  )

  return db
}
