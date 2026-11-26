import type { FixtureImage, FixtureWorkload, ImageCve } from '#scripts/fixtures/fixtureModel.ts'
import { packageOriginFields } from '#scripts/fixtures/packageOrigins.ts'
import { DEFAULT_SOURCE_QUERIES } from '#server/sources/sourceQueries.ts'

export const SCAN_TIME = '2026-11-20T05:27:47Z'
export const SAMPLE_TIME = 1795645763.331

/**
 * Returns the image_ref of an image, registry server + "/" + repository.
 * @param {FixtureImage} image - Image
 * @returns {string} - Image reference
 */
export const imageRefOf = (image: FixtureImage): string => `${image.server}/${image.repository}`

/**
 * Builds one VulnerabilityReport in the shape trivy-operator writes, with the additional fields
 * target, class, packageType and pkgPath plus packagePURL for most images.
 * @param {FixtureWorkload} workload - Workload
 * @param {string} container - Container name
 * @param {FixtureImage} image - Image of the container
 * @param {readonly ImageCve[]} cves - CVEs to list
 * @returns {Record<string, unknown>} - VulnerabilityReport object
 */
export const vulnerabilityReport = (
  workload: FixtureWorkload,
  container: string,
  image: FixtureImage,
  cves: readonly ImageCve[],
): Record<string, unknown> => {
  const vulnerabilities = cves.flatMap(({ cve, packages }) =>
    packages.flatMap((pkg) =>
      packageOriginFields(image, pkg).map((origin) => ({
        fixedVersion: pkg.fixed,
        installedVersion: pkg.installed,
        lastModifiedDate: SCAN_TIME,
        links: [],
        primaryLink: `https://avd.aquasec.com/nvd/${cve.id.toLowerCase()}`,
        publishedDate: cve.publishedDate,
        resource: pkg.name,
        ...(cve.score === null ? {} : { score: cve.score }),
        severity: cve.trivySeverity,
        title: cve.title,
        vulnerabilityID: cve.id,
        ...origin,
      })),
    ),
  )
  /**
   * Counts the vulnerabilities of one Trivy severity.
   * @param {string} severity - Upper case severity
   * @returns {number} - Count
   */
  const count = (severity: string): number =>
    vulnerabilities.filter((vulnerability) => vulnerability.severity === severity).length

  return {
    apiVersion: 'aquasecurity.github.io/v1alpha1',
    kind: 'VulnerabilityReport',
    metadata: {
      name: `${workload.kind.toLowerCase()}-${workload.resourceName}-${container}`,
      namespace: workload.namespace,
      labels: {
        'app.kubernetes.io/managed-by': 'trivy-operator',
        'trivy-operator.container.name': container,
        'trivy-operator.resource.kind': workload.kind,
        'trivy-operator.resource.name': workload.resourceName,
        'trivy-operator.resource.namespace': workload.namespace,
      },
    },
    report: {
      artifact: { digest: image.digest, repository: image.repository, tag: image.tag },
      os: image.os,
      registry: { server: image.server },
      scanner: { name: 'Trivy', vendor: 'Aqua Security', version: '0.76.1' },
      summary: {
        criticalCount: count('CRITICAL'),
        highCount: count('HIGH'),
        lowCount: count('LOW'),
        mediumCount: count('MEDIUM'),
        noneCount: 0,
        unknownCount: count('UNKNOWN'),
      },
      updateTimestamp: SCAN_TIME,
      vulnerabilities,
    },
  }
}

/**
 * Builds one sample of the default findings query, labels exactly as the recording rule emits them.
 * @param {FixtureWorkload} workload - Workload
 * @param {FixtureImage} image - Image
 * @param {ImageCve} entry - CVE in that image
 * @returns {Record<string, unknown>} - Vector sample
 */
export const findingInfoSample = (
  workload: FixtureWorkload,
  image: FixtureImage,
  { cve }: ImageCve,
): Record<string, unknown> => ({
  metric: {
    __name__: DEFAULT_SOURCE_QUERIES.findings,
    ...(workload.exposure === null ? {} : { exposure: workload.exposure }),
    image_ref: imageRefOf(image),
    namespace: workload.namespace,
    owner: image.owner,
    resource_kind: workload.kind,
    resource_name: workload.resourceName,
    severity: cve.severity,
    ...(cve.severitySource ? { severity_source: cve.severitySource } : {}),
    vuln_id: cve.id,
    ...(cve.score === null ? {} : { vuln_score: String(cve.score) }),
  },
  value: [SAMPLE_TIME, '1'],
})
