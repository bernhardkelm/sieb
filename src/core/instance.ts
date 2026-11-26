import type { PackageLocation } from '#core/packageOrigin.ts'

/** Workload placement of an instance, the part of its key shared by a whole workload */
export interface InstanceWorkload {
  namespace: string
  resourceKind: string
  resourceName: string
}

/** Fields an instance gets from the VulnerabilityReport, null without a matching report row */
export interface InstanceDetails {
  container: string | null
  imageTag: string | null
  imageDigest: string | null
  package: string | null
  installedVersion: string | null
  fixedVersion: string | null
  locations: PackageLocation[] // where Trivy found the package, distinct, empty when unknown
  packageType: string | null // Trivy package type, such as gobinary, npm or debian
  packageClass: string | null // Trivy class, such as os-pkgs or lang-pkgs
  purl: string | null
}

/** One sighting of a finding: workload x container x package x installed version */
export interface FindingInstance extends InstanceWorkload, InstanceDetails {
  id: number
  findingId: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
}

/** Package and versions of an instance, as compact listings show them */
export type PackageVersion = Pick<InstanceDetails, 'package' | 'installedVersion' | 'fixedVersion'>

/**
 * Returns the distinct package versions of several instances, in input order.
 * @param {readonly PackageVersion[]} instances - Instances
 * @returns {PackageVersion[]} - Package, installed and fixed version without duplicates
 */
export const distinctPackageVersions = (instances: readonly PackageVersion[]): PackageVersion[] => {
  const seen = new Map<string, PackageVersion>()

  for (const { package: name, installedVersion, fixedVersion } of instances) {
    const key = JSON.stringify([name, installedVersion, fixedVersion])

    if (!seen.has(key)) {
      seen.set(key, { package: name, installedVersion, fixedVersion })
    }
  }

  return [...seen.values()]
}

/**
 * Returns the current instances of a finding: the open ones, or the last sighting of a resolved
 * finding.
 * @param {readonly T[]} instances - Instances of the finding
 * @param {string | null} resolvedAt - Resolution time of the finding
 * @returns {T[]} - Current instances
 */
export const currentInstances = <T extends Pick<FindingInstance, 'resolvedAt'>>(
  instances: readonly T[],
  resolvedAt: string | null,
): T[] =>
  instances.filter((instance) => instance.resolvedAt === null || instance.resolvedAt === resolvedAt)
