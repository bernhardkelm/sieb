import { filterFindings } from '#core/findingFilter.ts'
import type { FindingQuery } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'
import { listFindingViews } from '#server/db/findingViews.ts'
import { listKevDatesAdded } from '#server/db/kevCatalogRepository.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

export interface FindingSearch {
  findings: FindingView[] // matching findings in inbox order
  notes: string[] // filters that could not be applied as asked
}

/**
 * Lists the findings matching a query, in inbox order. kevAddedSince needs the CISA catalog: with
 * another KEV source it is ignored and a note says so.
 * @param {McpToolDeps} deps - Database, clock and KEV source
 * @param {FindingQuery} query - Core finding query
 * @returns {FindingSearch} - Matches and notes
 */
export const searchFindings = (
  { db, clock, kevSource }: McpToolDeps,
  query: FindingQuery,
): FindingSearch => {
  const notes: string[] = []
  const kevDatesAdded = kevSource === 'cisa' ? listKevDatesAdded(db) : null

  if (query.kevAddedSince && kevDatesAdded === null) {
    notes.push(
      `kevAddedSince was ignored: the KEV source is ${kevSource}, only the cisa source knows when a CVE was added`,
    )
  }

  if (query.kevAddedSince && kevDatesAdded?.size === 0) {
    notes.push('kevAddedSince matched nothing: the CISA KEV catalog has not been fetched yet')
  }

  const findings = filterFindings(
    listFindingViews(db, clock(), { includeResolved: query.includeResolved }),
    query,
    { kevDatesAdded },
  )

  return { findings, notes }
}
