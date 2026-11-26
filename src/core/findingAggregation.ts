import type { FindingFields } from '#core/finding.ts'
import { findingKey } from '#core/instanceKey.ts'
import { maxExposure } from '#core/exposure.ts'
import { firstOwner } from '#core/owner.ts'
import { isSeverityHigher, maxSeverity } from '#core/severity.ts'
import type { SourceInstance } from '#core/sourceSnapshot.ts'

export interface FindingGroup {
  vulnId: string
  imageRef: string
  instances: SourceInstance[]
}

/**
 * Groups source rows by finding, vuln_id x image_ref, in order of first appearance.
 * @param {readonly SourceInstance[]} instances - Snapshot rows
 * @returns {FindingGroup[]} - One group per finding
 */
export const groupByFinding = (instances: readonly SourceInstance[]): FindingGroup[] => {
  const groups = new Map<string, FindingGroup>()

  for (const instance of instances) {
    const key = findingKey(instance.vulnId, instance.imageRef)
    const group = groups.get(key)

    if (group) {
      group.instances.push(instance)
    } else {
      groups.set(key, {
        vulnId: instance.vulnId,
        imageRef: instance.imageRef,
        instances: [instance],
      })
    }
  }

  return [...groups.values()]
}

/**
 * Aggregates the instances of one finding: highest severity with its source, highest score,
 * highest exposure (unknown above internal), the owner ranked first (self, then alphabetical),
 * the first title and link,
 * and KEV from the KEV list.
 * @param {readonly SourceInstance[]} instances - Rows of one finding, at least one
 * @param {ReadonlySet<string>} kevIds - Vuln ids on the KEV list
 * @returns {FindingFields} - Finding-level fields
 */
export const aggregateFinding = (
  instances: readonly SourceInstance[],
  kevIds: ReadonlySet<string>,
): FindingFields => {
  const severity = maxSeverity(instances.map((instance) => instance.severity))
  const scores = instances.flatMap((instance) => (instance.score === null ? [] : [instance.score]))
  const atSeverity = instances.filter((instance) => !isSeverityHigher(severity, instance.severity))

  return {
    severity,
    score: scores.length > 0 ? Math.max(...scores) : null,
    severitySource: atSeverity.find((instance) => instance.severitySource)?.severitySource ?? null,
    kev: instances.some((instance) => kevIds.has(instance.vulnId)),
    exposure: maxExposure(instances.map((instance) => instance.exposure)),
    owner: firstOwner(instances.map((instance) => instance.owner)),
    title: instances.find((instance) => instance.title)?.title ?? null,
    primaryLink: instances.find((instance) => instance.primaryLink)?.primaryLink ?? null,
  }
}
