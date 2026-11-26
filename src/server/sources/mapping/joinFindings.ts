import type { SourceInstance } from '#core/sourceSnapshot.ts'
import type { InfoSeries } from '#server/sources/mapping/prometheusVector.ts'
import type { ReportVulnerability } from '#server/sources/mapping/vulnerabilityReports.ts'

type JoinFields = Pick<
  InfoSeries,
  'namespace' | 'resourceKind' | 'resourceName' | 'imageRef' | 'vulnId'
>

/**
 * Builds the join key of a Prometheus series and a report vulnerability.
 * @param {JoinFields} row - Either side
 * @returns {string} - Key over namespace, kind, name, image_ref and vuln_id
 */
export const joinKey = (row: JoinFields): string =>
  JSON.stringify([row.namespace, row.resourceKind, row.resourceName, row.imageRef, row.vulnId])

/**
 * Joins the Prometheus info series with the report vulnerabilities. Prometheus decides what is
 * a finding and wins for severity, score, exposure and owner; every matching report row adds an
 * instance with container, package and versions. A series without report rows yields one
 * instance with those fields null. Report rows without a series are dropped: Prometheus already
 * filters to fixable findings and re-rates their severity.
 * @param {readonly InfoSeries[]} info - Info series
 * @param {readonly ReportVulnerability[]} vulnerabilities - Report vulnerabilities
 * @returns {SourceInstance[]} - Joined rows
 */
export const joinFindings = (
  info: readonly InfoSeries[],
  vulnerabilities: readonly ReportVulnerability[],
): SourceInstance[] => {
  const byKey = new Map<string, ReportVulnerability[]>()

  for (const vulnerability of vulnerabilities) {
    const key = joinKey(vulnerability)
    byKey.set(key, [...(byKey.get(key) ?? []), vulnerability])
  }

  return info.flatMap((series) => {
    const matches = byKey.get(joinKey(series)) ?? []

    if (matches.length === 0) {
      return [
        {
          ...series,
          container: null,
          imageTag: null,
          imageDigest: null,
          package: null,
          installedVersion: null,
          fixedVersion: null,
          title: null,
          primaryLink: null,
        },
      ]
    }

    return matches.map((match) => ({
      ...series,
      container: match.container,
      imageTag: match.imageTag,
      imageDigest: match.imageDigest,
      package: match.package,
      installedVersion: match.installedVersion,
      fixedVersion: match.fixedVersion,
      title: match.title,
      primaryLink: match.primaryLink,
    }))
  })
}
