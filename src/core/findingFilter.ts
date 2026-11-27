import { matchesExposureFilter } from '#core/exposure.ts'
import {
  matchesFacts,
  matchesNames,
  matchesSearch,
  type FilterableFinding,
  type FindingFilterContext,
} from '#core/findingFilterMatchers.ts'
import type { FindingQuery } from '#core/findingQuery.ts'

const NO_CONTEXT: FindingFilterContext = { kevDatesAdded: null }

/**
 * Returns whether a finding passes all filters of a query. The inbox view keeps inbox findings
 * only, the all view drops resolved findings unless includeResolved is set. An exposure or owner
 * filter drops findings without that label, unless the exposure filter selects unknown.
 * @param {FilterableFinding} finding - Finding
 * @param {FindingQuery} query - Parsed query
 * @param {FindingFilterContext} context - KEV catalog dates and pending index, the filters reading them are ignored without
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

  if (!matchesExposureFilter(query.exposure, finding.exposure)) {
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
 * @param {FindingFilterContext} context - KEV catalog dates and pending index, the filters reading them are ignored without
 * @returns {T[]} - Matching findings
 */
export const filterFindings = <T extends FilterableFinding>(
  findings: readonly T[],
  query: FindingQuery,
  context: FindingFilterContext = NO_CONTEXT,
): T[] => findings.filter((finding) => matchesFindingQuery(finding, query, context))
