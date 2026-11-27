import type { DatabaseSync } from 'node:sqlite'

import type { SourceInstance } from '#core/sourceSnapshot.ts'
import { listOpenFindings } from '#server/db/findingRepository.ts'
import { MEMORY_DB, openDatabase } from '#server/db/openDatabase.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildSnapshot, NGINX } from './dbFixtures.ts'

export const COREDNS = 'index.docker.io/rancher/mirrored-coredns-coredns'
export const TARGET_CVE = 'CVE-2099-00001'
export const SIBLING_CVE = 'CVE-2099-00002'
export const OTHER_SIBLING_CVE = 'CVE-2099-00003'
export const GONE_CVE = 'CVE-2099-00004'

const PSEUDO = 'v0.0.0-20260101000000-abcdef123456'

const ROWS: Partial<SourceInstance>[] = [
  { vulnId: TARGET_CVE, imageRef: COREDNS, package: 'github.com/coredns/coredns' },
  { vulnId: SIBLING_CVE, imageRef: COREDNS, package: 'github.com/coredns/coredns' },
  { vulnId: OTHER_SIBLING_CVE, imageRef: COREDNS, package: 'github.com/coredns/coredns' },
  { vulnId: SIBLING_CVE, imageRef: NGINX, package: 'github.com/coredns/coredns' },
].map((row) => ({ ...row, installedVersion: PSEUDO, fixedVersion: '1.11.0' }))

export interface RelatedSetup {
  db: DatabaseSync
  target: number // TARGET_CVE in COREDNS
  sibling: number // SIBLING_CVE in COREDNS
  otherSibling: number // OTHER_SIBLING_CVE in COREDNS
  elsewhere: number // SIBLING_CVE in NGINX
  resolved: number // GONE_CVE in COREDNS, resolved by the second sync
}

/**
 * Returns the id of the finding of a CVE in an image.
 * @param {DatabaseSync} db - Database
 * @param {string} vulnId - Vulnerability
 * @param {string} imageRef - Image
 * @returns {number} - Finding id
 */
const findingIdOf = (db: DatabaseSync, vulnId: string, imageRef: string): number =>
  Number(
    db.prepare('SELECT id FROM findings WHERE vuln_id = ? AND image_ref = ?').get(vulnId, imageRef)
      ?.id,
  )

/**
 * Opens an in-memory database with three open findings of the coredns module on the coredns
 * image, one more on nginx and a fourth coredns one the second sync resolved.
 * @param {Date} now - Time of the second sync
 * @returns {RelatedSetup} - Database and finding ids
 */
export const relatedDatabase = (now: Date): RelatedSetup => {
  const db = openDatabase(MEMORY_DB)

  applySnapshot(
    db,
    buildSnapshot([...ROWS, { vulnId: GONE_CVE, imageRef: COREDNS }]),
    new Date(now.getTime() - 86_400_000),
  )
  applySnapshot(db, buildSnapshot(ROWS), now)

  if (listOpenFindings(db).length !== ROWS.length) {
    throw new Error('unexpected open findings')
  }

  return {
    db,
    target: findingIdOf(db, TARGET_CVE, COREDNS),
    sibling: findingIdOf(db, SIBLING_CVE, COREDNS),
    otherSibling: findingIdOf(db, OTHER_SIBLING_CVE, COREDNS),
    elsewhere: findingIdOf(db, SIBLING_CVE, NGINX),
    resolved: findingIdOf(db, GONE_CVE, COREDNS),
  }
}
