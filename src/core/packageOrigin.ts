import type { InstanceDetails } from '#core/instance.ts'

/** One place the Trivy report names for a package */
export interface PackageLocation {
  target: string | null // scan target: a binary, a lockfile or the OS release of the image
  pkgPath: string | null // file of the package inside the image, when Trivy reports one
}

/** Where one package of a finding sits, merged over its instances */
export interface PackageOrigin {
  package: string | null
  installedVersion: string | null
  packageType: string | null // Trivy package type, its class when only that is known
  purl: string | null
  paths: string[]
}

export type OriginFields = Pick<
  InstanceDetails,
  'package' | 'installedVersion' | 'locations' | 'packageType' | 'packageClass' | 'purl'
>

/** Upper bound of locations kept per instance */
export const MAX_LOCATIONS = 20

/**
 * Returns the path a location points at: the package file when Trivy names one, else the target.
 * @param {PackageLocation} location - Location
 * @returns {string | null} - Path, null when both are unknown
 */
export const locationPath = (location: PackageLocation): string | null =>
  location.pkgPath ?? location.target

/**
 * Merges location lists into one without duplicates, in input order, capped at MAX_LOCATIONS.
 * @param {readonly (readonly PackageLocation[])[]} lists - Location lists
 * @returns {PackageLocation[]} - Distinct locations
 */
export const mergeLocations = (
  lists: readonly (readonly PackageLocation[])[],
): PackageLocation[] => {
  const seen = new Map<string, PackageLocation>()

  for (const location of lists.flat()) {
    const key = JSON.stringify([location.target, location.pkgPath])

    if (!seen.has(key) && seen.size < MAX_LOCATIONS) {
      seen.set(key, { target: location.target, pkgPath: location.pkgPath })
    }
  }

  return [...seen.values()]
}

/**
 * Returns whether an instance carries any location, package type, class or PURL.
 * @param {OriginFields} instance - Instance
 * @returns {boolean} - True when Trivy reported where the package sits
 */
const hasOrigin = (instance: OriginFields): boolean =>
  instance.locations.length > 0 ||
  instance.packageType !== null ||
  instance.packageClass !== null ||
  instance.purl !== null

/**
 * Merges the origins of instances per package and installed version, in input order. Paths are
 * distinct; the package type is the first one reported, else the first class; the PURL is the
 * first one reported. Instances without any origin data are left out, so the result is empty
 * when the reports name nothing.
 * @param {readonly OriginFields[]} instances - Instances of one finding
 * @returns {PackageOrigin[]} - One origin per package version
 */
export const packageOrigins = (instances: readonly OriginFields[]): PackageOrigin[] => {
  const groups = new Map<string, OriginFields[]>()

  for (const instance of instances.filter(hasOrigin)) {
    const key = JSON.stringify([instance.package, instance.installedVersion])
    groups.set(key, [...(groups.get(key) ?? []), instance])
  }

  return [...groups.values()].flatMap(([first, ...rest]) => {
    if (!first) {
      return []
    }

    const group = [first, ...rest]
    const paths = group.flatMap((instance) =>
      instance.locations.flatMap((location) => locationPath(location) ?? []),
    )

    return [
      {
        package: first.package,
        installedVersion: first.installedVersion,
        packageType:
          group.find((instance) => instance.packageType)?.packageType ??
          group.find((instance) => instance.packageClass)?.packageClass ??
          null,
        purl: group.find((instance) => instance.purl)?.purl ?? null,
        paths: [...new Set(paths)],
      },
    ]
  })
}
