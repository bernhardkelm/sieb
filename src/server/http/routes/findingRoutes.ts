import { Hono } from 'hono'

import type { FindingDetailResponse } from '#core/apiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { filterFindings } from '#core/findingFilter.ts'
import { parseFindingQuery } from '#core/findingQuery.ts'
import { sourceAccess } from '#core/sourceAccess.ts'
import { getFindingDetail, listFindingViews } from '#server/db/findingViews.ts'
import { listKevDatesAdded } from '#server/db/kevCatalogRepository.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { parseId } from '#server/http/pathParams.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the finding routes: GET / lists findings in inbox order filtered by the query
 * parameters of parseFindingQuery, kevAddedSince only with the cisa KEV source; GET /:id
 * answers the detail of the side panel, with the CISA catalog entry of a KEV listed finding
 * when the KEV source is cisa and the source access of its image.
 * @param {RouteDeps & { publicRegistries: readonly string[] }} deps - Database, clock, KEV source and public registries
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/findings
 */
export const createFindingRoutes = ({
  db,
  clock,
  kevSource,
  publicRegistries,
}: RouteDeps & { publicRegistries: readonly string[] }): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const query = parseFindingQuery(c.req.query())

    if (!query.ok) {
      return validationFailed(c, query.errors)
    }

    const kevDatesAdded = kevSource === 'cisa' ? listKevDatesAdded(db) : null

    return c.json<FindingView[]>(
      filterFindings(listFindingViews(db, clock()), query.value, { kevDatesAdded }),
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
