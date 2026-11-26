import type { InstanceDetails, InstanceWorkload } from '#core/instance.ts'

export type InstanceKeyFields = InstanceWorkload &
  Pick<InstanceDetails, 'container' | 'package' | 'installedVersion'>

/**
 * Builds the natural key of an instance within its finding: workload, container, package and
 * installed version. Missing parts stay distinguishable from empty strings.
 * @param {InstanceKeyFields} instance - Instance fields
 * @returns {string} - Stable key
 */
export const instanceKey = (instance: InstanceKeyFields): string =>
  JSON.stringify([
    instance.namespace,
    instance.resourceKind,
    instance.resourceName,
    instance.container,
    instance.package,
    instance.installedVersion,
  ])

/**
 * Builds the key of a finding, vuln_id x image_ref.
 * @param {string} vulnId - Vulnerability id
 * @param {string} imageRef - Image reference without tag
 * @returns {string} - Stable key
 */
export const findingKey = (vulnId: string, imageRef: string): string =>
  JSON.stringify([vulnId, imageRef])
