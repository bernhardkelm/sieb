import { filterFindings } from '#core/findingFilter.ts'
import type { FindingQuery } from '#core/findingQuery.ts'
import type { FindingView } from '#core/findingView.ts'
import { listFindingViews } from '#server/db/findingViews.ts'
import { listKevDatesAdded } from '#server/db/kevCatalogRepository.ts'
import { readPendingIndex } from '#server/db/readPendingIndex.ts'
import type { McpToolDeps } from '#server/mcp/mcpToolDeps.ts'

export interface FindingSearch {
  findings: FindingView[] // matching findings in inbox order
  notes: string[] // filters that could not be applied as asked
}

/**
 * Lists the findings matching a query, in inbox order. kevAddedSince needs the CISA catalog: with
 * another KEV source it is ignored and a note says so. pending reads the Inbox of the caller and,
 * with Auto-check on, the open checks.
 * @param {McpToolDeps} deps - Database, clock, KEV source and Auto-check state
 * @param {FindingQuery} query - Core finding query
 * @param {string} actor - sieb user whose Inbox pending reads
 * @returns {FindingSearch} - Matches and notes
 */
export const searchFindings = (
  { db, clock, kevSource, checksEnabled = false }: McpToolDeps,
  query: FindingQuery,
  actor: string,
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

  if (query.pending?.includes('checking') && !checksEnabled) {
    notes.push('pending checking was ignored: Auto-check is off')
  }

  const now = clock()
  const pending = query.pending?.length ? readPendingIndex(db, actor, now, checksEnabled) : null
  const findings = filterFindings(
    listFindingViews(db, now, { includeResolved: query.includeResolved }),
    query,
    { kevDatesAdded, pending },
  )

  return { findings, notes }
}
