import { instanceKey, type InstanceKeyFields } from '#core/instanceKey.ts'
import { mergeLocations, type OriginFields } from '#core/packageOrigin.ts'

/**
 * Collapses the rows of one finding that share an instance key, such as one package Trivy found
 * in two binaries of the same container. The first row wins, the locations of all rows are
 * merged, package type, class and PURL fall back to the first row that has them.
 * @param {readonly T[]} instances - Rows of one finding
 * @returns {T[]} - One row per instance key, in order of first appearance
 */
export const mergeDuplicateInstances = <T extends InstanceKeyFields & OriginFields>(
  instances: readonly T[],
): T[] => {
  const merged = new Map<string, T>()

  for (const instance of instances) {
    const key = instanceKey(instance)
    const first = merged.get(key)

    merged.set(
      key,
      first
        ? {
            ...first,
            locations: mergeLocations([first.locations, instance.locations]),
            packageType: first.packageType ?? instance.packageType,
            packageClass: first.packageClass ?? instance.packageClass,
            purl: first.purl ?? instance.purl,
          }
        : { ...instance, locations: mergeLocations([instance.locations]) },
    )
  }

  return [...merged.values()]
}
