import type { FindingQuery } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'

type FilterableFinding = Pick<
  FindingView,
  | 'vulnId'
  | 'imageRef'
  | 'title'
  | 'packages'
  | 'workloads'
  | 'severity'
  | 'exposure'
  | 'owner'
  | 'firstSeen'
  | 'resolvedAt'
  | 'inInbox'
>

/**
 * Returns whether a finding contains a search text, case-insensitive, in its vuln_id, image_ref,
 * title, packages or workloads.
 * @param {FilterableFinding} finding - Finding
 * @param {string} q - Search text
 * @returns {boolean} - True on a match
 */
export const matchesSearch = (finding: FilterableFinding, q: string): boolean => {
  const needle = q.toLowerCase()
  const haystack = [
    finding.vulnId,
    finding.imageRef,
    finding.title ?? '',
    ...finding.packages,
    ...finding.workloads,
  ]

  return haystack.some((value) => value.toLowerCase().includes(needle))
}

/**
 * Returns whether a finding passes all filters of a query. The inbox view keeps inbox findings
 * only, the all view drops resolved findings unless includeResolved is set. An exposure or owner
 * filter drops findings without that label.
 * @param {FilterableFinding} finding - Finding
 * @param {FindingQuery} query - Parsed query
 * @returns {boolean} - True when the finding is listed
 */
export const matchesFindingQuery = (finding: FilterableFinding, query: FindingQuery): boolean => {
  if (query.view === 'inbox' ? !finding.inInbox : !query.includeResolved && finding.resolvedAt) {
    return false
  }

  if (query.severity.length > 0 && !query.severity.includes(finding.severity)) {
    return false
  }

  if (
    query.exposure.length > 0 &&
    (finding.exposure === null || !query.exposure.includes(finding.exposure))
  ) {
    return false
  }

  if (query.owner.length > 0 && (finding.owner === null || !query.owner.includes(finding.owner))) {
    return false
  }

  if (query.newSince !== null && Date.parse(finding.firstSeen) < Date.parse(query.newSince)) {
    return false
  }

  return query.q === null || matchesSearch(finding, query.q)
}

/**
 * Filters findings by a query, keeping their order.
 * @param {readonly T[]} findings - Findings, usually in inbox order
 * @param {FindingQuery} query - Parsed query
 * @returns {T[]} - Matching findings
 */
export const filterFindings = <T extends FilterableFinding>(
  findings: readonly T[],
  query: FindingQuery,
): T[] => findings.filter((finding) => matchesFindingQuery(finding, query))
