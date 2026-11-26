import { matchesDecisionStates } from '#core/decisionStateFilter.ts'
import type { FindingQuery } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'
import { matchesAnyName, withoutImageTag, workloadNames } from '#core/nameMatch.ts'

type FilterableFinding = Pick<
  FindingView,
  | 'vulnId'
  | 'imageRef'
  | 'title'
  | 'packages'
  | 'namespaces'
  | 'workloads'
  | 'severity'
  | 'score'
  | 'exposure'
  | 'owner'
  | 'firstSeen'
  | 'resolvedAt'
  | 'inInbox'
  | 'kev'
  | 'fixable'
  | 'decision'
  | 'effective'
>

/** Data some filters need beyond the finding itself */
export interface FindingFilterContext {
  kevDatesAdded: ReadonlyMap<string, string> | null // CISA date_added per CVE, null without the cisa catalog, kevAddedSince is then ignored
}

const NO_CONTEXT: FindingFilterContext = { kevDatesAdded: null }

/**
 * Returns whether a finding contains a search text, case-insensitive, in its vuln_id, image_ref,
 * title, packages, namespaces or workloads.
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
    ...finding.namespaces,
    ...finding.workloads,
  ]

  return haystack.some((value) => value.toLowerCase().includes(needle))
}

/**
 * Returns whether a finding passes the name pattern filters of a query.
 * @param {FilterableFinding} finding - Finding
 * @param {FindingQuery} query - Parsed query
 * @returns {boolean} - True when every given name filter matches
 */
const matchesNames = (finding: FilterableFinding, query: FindingQuery): boolean =>
  matchesAnyName([finding.vulnId], query.vulnIds) &&
  matchesAnyName(finding.packages, query.packages) &&
  matchesAnyName([finding.imageRef], query.images?.map(withoutImageTag)) &&
  matchesAnyName(finding.namespaces, query.namespaces) &&
  matchesAnyName(finding.workloads.flatMap(workloadNames), query.workloads)

/**
 * Returns whether a finding passes the score, fixable, decision state and KEV date filters.
 * @param {FilterableFinding} finding - Finding
 * @param {FindingQuery} query - Parsed query
 * @param {FindingFilterContext} context - KEV catalog dates
 * @returns {boolean} - True when every given filter matches
 */
const matchesFacts = (
  finding: FilterableFinding,
  query: FindingQuery,
  context: FindingFilterContext,
): boolean => {
  const minScore = query.minScore ?? null
  const fixable = query.fixable ?? null
  const kevAddedSince = query.kevAddedSince ?? null

  if (minScore !== null && (finding.score === null || finding.score < minScore)) {
    return false
  }

  if (fixable !== null && finding.fixable !== fixable) {
    return false
  }

  if (kevAddedSince !== null && context.kevDatesAdded !== null) {
    const dateAdded = context.kevDatesAdded.get(finding.vulnId)

    if (!finding.kev || dateAdded === undefined || dateAdded < kevAddedSince) {
      return false
    }
  }

  return matchesDecisionStates(finding, query.decisionState ?? [])
}

/**
 * Returns whether a finding passes all filters of a query. The inbox view keeps inbox findings
 * only, the all view drops resolved findings unless includeResolved is set. An exposure or owner
 * filter drops findings without that label.
 * @param {FilterableFinding} finding - Finding
 * @param {FindingQuery} query - Parsed query
 * @param {FindingFilterContext} context - KEV catalog dates, kevAddedSince is ignored without
 * @returns {boolean} - True when the finding is listed
 */
export const matchesFindingQuery = (
  finding: FilterableFinding,
  query: FindingQuery,
  context: FindingFilterContext = NO_CONTEXT,
): boolean => {
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

  if (query.kev && !finding.kev) {
    return false
  }

  if (!matchesNames(finding, query) || !matchesFacts(finding, query, context)) {
    return false
  }

  return query.q === null || matchesSearch(finding, query.q)
}

/**
 * Filters findings by a query, keeping their order.
 * @param {readonly T[]} findings - Findings, usually in inbox order
 * @param {FindingQuery} query - Parsed query
 * @param {FindingFilterContext} context - KEV catalog dates, kevAddedSince is ignored without
 * @returns {T[]} - Matching findings
 */
export const filterFindings = <T extends FilterableFinding>(
  findings: readonly T[],
  query: FindingQuery,
  context: FindingFilterContext = NO_CONTEXT,
): T[] => findings.filter((finding) => matchesFindingQuery(finding, query, context))
