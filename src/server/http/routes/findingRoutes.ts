import { Hono } from 'hono'

import type { FindingDetailResponse } from '#core/apiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { filterFindings } from '#core/findingFilter.ts'
import { parseFindingQuery } from '#core/findingQuery.ts'
import { sourceAccess } from '#core/sourceAccess.ts'
import { getFindingDetail, listFindingViews } from '#server/db/findingViews.ts'
import { listKevDatesAdded } from '#server/db/kevCatalogRepository.ts'
import { readPendingIndex } from '#server/db/readPendingIndex.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { parseId } from '#server/http/pathParams.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

export type FindingRouteDeps = RouteDeps & {
  publicRegistries: readonly string[]
  checksEnabled: boolean // pending=checking reads the open checks only with Auto-check on
}

/**
 * Creates the finding routes: GET / lists findings in inbox order filtered by the query
 * parameters of parseFindingQuery, kevAddedSince only with the cisa KEV source, pending against
 * the Inbox of the acting user and the open checks; GET /:id answers the detail of the side
 * panel, with the CISA catalog entry of a KEV listed finding when the KEV source is cisa and the
 * source access of its image.
 * @param {FindingRouteDeps} deps - Database, clock, KEV source, public registries and Auto-check state
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/findings
 */
export const createFindingRoutes = ({
  db,
  clock,
  kevSource,
  publicRegistries,
  checksEnabled,
}: FindingRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const query = parseFindingQuery(c.req.query())

    if (!query.ok) {
      return validationFailed(c, query.errors)
    }

    const now = clock()
    const kevDatesAdded = kevSource === 'cisa' ? listKevDatesAdded(db) : null
    const pending = query.value.pending?.length
      ? readPendingIndex(db, c.get('actor'), now, checksEnabled)
      : null

    return c.json<FindingView[]>(
      filterFindings(listFindingViews(db, now), query.value, { kevDatesAdded, pending }),
    )
  })

  routes.get('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const detail = id === null ? null : getFindingDetail(db, id, clock(), kevSource === 'cisa')

    if (!detail) {
      return notFound(c)
    }

    const { imageRef, owner } = detail.finding

    return c.json<FindingDetailResponse>({
      ...detail,
      sourceAccess: sourceAccess(imageRef, owner, publicRegistries),
    })
  })

  return routes
}
