import { matchesDecisionStates, matchesUpstreamPending } from '#core/decisionStateFilter.ts'
import { matchesPending, type PendingIndex } from '#core/findingPending.ts'
import type { FindingQuery } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'
import { matchesAnyName, withoutImageTag, workloadNames } from '#core/nameMatch.ts'

/** Fields of a finding the filters read */
export type FilterableFinding = Pick<
  FindingView,
  | 'id'
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
  pending?: PendingIndex | null // Inbox items and open checks, without them pending is ignored
}

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
export const matchesNames = (finding: FilterableFinding, query: FindingQuery): boolean =>
  matchesAnyName([finding.vulnId], query.vulnIds) &&
  matchesAnyName(finding.packages, query.packages) &&
  matchesAnyName([finding.imageRef], query.images?.map(withoutImageTag)) &&
  matchesAnyName(finding.namespaces, query.namespaces) &&
  matchesAnyName(finding.workloads.flatMap(workloadNames), query.workloads)

/**
 * Returns whether a finding passes the score, fixable, KEV date, pending, decision state and
 * upstream filters.
 * @param {FilterableFinding} finding - Finding
 * @param {FindingQuery} query - Parsed query
 * @param {FindingFilterContext} context - KEV catalog dates and the pending index
 * @returns {boolean} - True when every given filter matches
 */
export const matchesFacts = (
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

  if (context.pending && !matchesPending(finding, query.pending ?? [], context.pending)) {
    return false
  }

  return (
    matchesDecisionStates(finding, query.decisionState ?? []) &&
    matchesUpstreamPending(finding, query.upstreamPending)
  )
}
