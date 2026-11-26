import type { DatabaseSync } from 'node:sqlite'

import type { FindingInstance } from '#core/instance.ts'

export interface InstanceRow {
  id: number
  finding_id: number
  natural_key: string
  namespace: string
  resource_kind: string
  resource_name: string
  container: string | null
  image_tag: string | null
  image_digest: string | null
  package: string | null
  installed_version: string | null
  fixed_version: string | null
  first_seen: string
  last_seen: string
  resolved_at: string | null
}

/**
 * Maps a finding_instances row to the domain type.
 * @param {InstanceRow} row - Row
 * @returns {FindingInstance} - Instance
 */
export const toInstance = (row: InstanceRow): FindingInstance => ({
  id: row.id,
  findingId: row.finding_id,
  namespace: row.namespace,
  resourceKind: row.resource_kind,
  resourceName: row.resource_name,
  container: row.container,
  imageTag: row.image_tag,
  imageDigest: row.image_digest,
  package: row.package,
  installedVersion: row.installed_version,
  fixedVersion: row.fixed_version,
  firstSeen: row.first_seen,
  lastSeen: row.last_seen,
  resolvedAt: row.resolved_at,
})

/**
 * Lists the instances of a finding, open ones first, then by workload, container and package.
 * @param {DatabaseSync} db - Open database
 * @param {number} findingId - Finding id
 * @returns {FindingInstance[]} - Instances
 */
export const listInstances = (db: DatabaseSync, findingId: number): FindingInstance[] =>
  (
    db
      .prepare(
        `SELECT * FROM finding_instances WHERE finding_id = ?
         ORDER BY resolved_at IS NOT NULL, namespace, resource_kind, resource_name, container,
           package, installed_version`,
      )
      .all(findingId) as unknown as InstanceRow[]
  ).map(toInstance)
