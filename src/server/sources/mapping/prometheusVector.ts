import type { FindingKey } from '#core/finding.ts'
import type { InstanceWorkload } from '#core/instance.ts'
import { parseExposure, type Exposure } from '#core/exposure.ts'
import { parseOwner } from '#core/owner.ts'
import { parseSeverity, type Severity } from '#core/severity.ts'
import { asNumber, asRecord, asText } from '#server/sources/mapping/jsonAccess.ts'

/** One series of the findings query, a workload x CVE */
export interface InfoSeries extends FindingKey, InstanceWorkload {
  severity: Severity
  score: number | null
  severitySource: string | null
  exposure: Exposure | null
  owner: string | null
}

/**
 * Reads the label sets of a Prometheus instant query result.
 * @param {unknown} json - Parsed response of /api/v1/query
 * @param {string} query - Query, for the error message
 * @returns {Record<string, unknown>[]} - Label set per series
 * @throws {Error} - When the response is not a successful vector result
 */
export const parseVectorLabels = (json: unknown, query: string): Record<string, unknown>[] => {
  const response = asRecord(json)
  const data = asRecord(response.data)

  if (
    response.status !== 'success' ||
    data.resultType !== 'vector' ||
    !Array.isArray(data.result)
  ) {
    throw new Error(
      `Prometheus query ${query} did not return a vector (status ${String(response.status)})`,
    )
  }

  return data.result.map((sample) => asRecord(asRecord(sample).metric))
}

/**
 * Maps the findings query result. Series missing an identifying label are skipped. A missing or
 * unrecognised exposure label means unknown exposure, a missing or invalid owner label no owner
 * (both null), a missing severity Unknown, so a minimal rule that only adds image_ref to
 * trivy_vulnerability_id works.
 * @param {unknown} json - Parsed query response
 * @param {string} query - Findings query, for the error message
 * @returns {InfoSeries[]} - Series
 */
export const parseFindingInfo = (json: unknown, query: string): InfoSeries[] =>
  parseVectorLabels(json, query).flatMap((labels) => {
    const vulnId = asText(labels.vuln_id)
    const imageRef = asText(labels.image_ref)
    const namespace = asText(labels.namespace)
    const resourceKind = asText(labels.resource_kind)
    const resourceName = asText(labels.resource_name)

    if (!vulnId || !imageRef || !namespace || !resourceKind || !resourceName) {
      return []
    }

    return [
      {
        vulnId,
        imageRef,
        namespace,
        resourceKind,
        resourceName,
        severity: parseSeverity(asText(labels.severity)),
        score: asNumber(labels.vuln_score),
        severitySource: asText(labels.severity_source),
        exposure: parseExposure(labels.exposure),
        owner: parseOwner(labels.owner),
      },
    ]
  })

/**
 * Maps the KEV query result to the listed vuln ids.
 * @param {unknown} json - Parsed query response
 * @param {string} query - KEV query, for the error message
 * @returns {string[]} - Unique vuln ids
 */
export const parseKevListed = (json: unknown, query: string): string[] => [
  ...new Set(
    parseVectorLabels(json, query).flatMap((labels) => {
      const vulnId = asText(labels.vuln_id)

      return vulnId ? [vulnId] : []
    }),
  ),
]
