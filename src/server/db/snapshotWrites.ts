import type { DatabaseSync } from 'node:sqlite'

import type { FindingFields } from '#core/finding.ts'
import type { InstanceDetails, InstanceWorkload } from '#core/instance.ts'
import { toStoredLocations } from '#server/db/storedLocations.ts'

export interface SnapshotWriter {
  insertFinding: (
    key: { vulnId: string; imageRef: string },
    fields: FindingFields,
    at: string,
  ) => number
  updateFinding: (id: number, fields: FindingFields, at: string) => void
  insertInstance: (
    findingId: number,
    key: string,
    instance: InstanceWorkload & InstanceDetails,
    at: string,
  ) => void
  updateInstance: (id: number, instance: InstanceDetails, at: string) => void
  resolveFinding: (id: number, at: string) => void
  resolveInstance: (id: number, at: string) => void
}

/**
 * Converts finding fields to statement parameters.
 * @param {FindingFields} fields - Finding fields
 * @returns {Record<string, string | number | null>} - Parameters
 */
const findingParams = (fields: FindingFields): Record<string, string | number | null> => ({
  severity: fields.severity,
  score: fields.score,
  severitySource: fields.severitySource,
  kev: fields.kev ? 1 : 0,
  exposure: fields.exposure,
  owner: fields.owner,
  title: fields.title,
  primaryLink: fields.primaryLink,
})

/**
 * Converts the package origin of an instance to statement parameters.
 * @param {InstanceDetails} instance - Instance fields
 * @returns {Record<string, string | null>} - Parameters
 */
const originParams = (instance: InstanceDetails): Record<string, string | null> => ({
  locations: toStoredLocations(instance.locations),
  packageType: instance.packageType,
  packageClass: instance.packageClass,
  purl: instance.purl,
})

/**
 * Prepares the statements a sync writes with, so a large snapshot reuses them. kev_since takes
 * the sync time when a stored finding's flag turns on, and when a finding is inserted KEV listed
 * unless the snapshot is the initial import; it clears when the flag turns off. The CASE reads
 * the stored flag before the update.
 * @param {DatabaseSync} db - Open database
 * @param {boolean} initialImport - True for the first successful sync, whose KEV listings are not news
 * @returns {SnapshotWriter} - Write functions
 */
export const createSnapshotWriter = (db: DatabaseSync, initialImport = false): SnapshotWriter => {
  const insertFinding = db.prepare(
    `INSERT INTO findings (vuln_id, image_ref, severity, score, severity_source, kev, exposure,
       owner, title, primary_link, first_seen, last_seen, kev_since)
     VALUES (:vulnId, :imageRef, :severity, :score, :severitySource, :kev, :exposure, :owner,
       :title, :primaryLink, :at, :at, :kevSince)`,
  )
  const updateFinding = db.prepare(
    `UPDATE findings SET severity = :severity, score = :score, severity_source = :severitySource,
       kev = :kev, exposure = :exposure, owner = :owner, title = :title,
       primary_link = :primaryLink, last_seen = :at, resolved_at = NULL,
       kev_since = CASE WHEN :kev = 0 THEN NULL WHEN kev = 0 THEN :at ELSE kev_since END
     WHERE id = :id`,
  )
  const insertInstance = db.prepare(
    `INSERT INTO finding_instances (finding_id, natural_key, namespace, resource_kind,
       resource_name, container, image_tag, image_digest, package, installed_version,
       fixed_version, locations, package_type, package_class, purl, first_seen, last_seen)
     VALUES (:findingId, :key, :namespace, :resourceKind, :resourceName, :container, :imageTag,
       :imageDigest, :package, :installedVersion, :fixedVersion, :locations, :packageType,
       :packageClass, :purl, :at, :at)`,
  )
  const updateInstance = db.prepare(
    `UPDATE finding_instances SET image_tag = :imageTag, image_digest = :imageDigest,
       fixed_version = :fixedVersion, locations = :locations, package_type = :packageType,
       package_class = :packageClass, purl = :purl, last_seen = :at, resolved_at = NULL
     WHERE id = :id`,
  )
  const resolveFinding = db.prepare('UPDATE findings SET resolved_at = ? WHERE id = ?')
  const resolveInstance = db.prepare('UPDATE finding_instances SET resolved_at = ? WHERE id = ?')

  return {
    insertFinding: ({ vulnId, imageRef }, fields, at) =>
      Number(
        insertFinding.run({
          vulnId,
          imageRef,
          ...findingParams(fields),
          at,
          kevSince: fields.kev && !initialImport ? at : null,
        }).lastInsertRowid,
      ),
    updateFinding: (id, fields, at) => {
      updateFinding.run({ id, ...findingParams(fields), at })
    },
    insertInstance: (findingId, key, instance, at) => {
      insertInstance.run({
        findingId,
        key,
        namespace: instance.namespace,
        resourceKind: instance.resourceKind,
        resourceName: instance.resourceName,
        container: instance.container,
        imageTag: instance.imageTag,
        imageDigest: instance.imageDigest,
        package: instance.package,
        installedVersion: instance.installedVersion,
        fixedVersion: instance.fixedVersion,
        ...originParams(instance),
        at,
      })
    },
    updateInstance: (id, instance, at) => {
      const { imageTag, imageDigest, fixedVersion } = instance

      updateInstance.run({ id, imageTag, imageDigest, fixedVersion, ...originParams(instance), at })
    },
    resolveFinding: (id, at) => {
      resolveFinding.run(at, id)
    },
    resolveInstance: (id, at) => {
      resolveInstance.run(at, id)
    },
  }
}
