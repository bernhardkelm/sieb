import type { DatabaseSync } from 'node:sqlite'

import { distinctPackageVersions, type PackageVersion } from '#core/instance.ts'

interface VersionRow {
  finding_id: number
  package: string | null
  installed_version: string | null
  fixed_version: string | null
}

/**
 * Lists the package versions of the current instances of several findings: open instances, or
 * the last sighting of a resolved finding, as listFindingSummaries counts them.
 * @param {DatabaseSync} db - Open database
 * @param {readonly number[]} findingIds - Finding ids
 * @returns {Map<number, PackageVersion[]>} - Distinct versions per finding id, absent without instances
 */
export const listCurrentVersions = (
  db: DatabaseSync,
  findingIds: readonly number[],
): Map<number, PackageVersion[]> => {
  const rows = db
    .prepare(
      `SELECT i.finding_id, i.package, i.installed_version, i.fixed_version
       FROM finding_instances i
       JOIN findings f ON f.id = i.finding_id
       WHERE i.finding_id IN (SELECT value FROM json_each(?))
         AND (i.resolved_at IS NULL OR i.resolved_at = f.resolved_at)
       ORDER BY i.finding_id, i.package, i.installed_version`,
    )
    .all(JSON.stringify(findingIds)) as unknown as VersionRow[]
  const byFinding = new Map<number, PackageVersion[]>()

  for (const row of rows) {
    const versions = byFinding.get(row.finding_id) ?? []

    versions.push({
      package: row.package,
      installedVersion: row.installed_version,
      fixedVersion: row.fixed_version,
    })
    byFinding.set(row.finding_id, versions)
  }

  return new Map(
    [...byFinding].map(([findingId, versions]) => [findingId, distinctPackageVersions(versions)]),
  )
}
