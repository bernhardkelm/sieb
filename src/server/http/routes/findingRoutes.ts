import { Hono } from 'hono'

import type { FindingDetail, FindingView } from '#core/findingView.ts'
import { filterFindings } from '#core/findingFilter.ts'
import { parseFindingQuery } from '#core/findingQuery.ts'
import { getFindingDetail, listFindingViews } from '#server/db/findingViews.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { parseId } from '#server/http/pathParams.ts'
import { notFound, validationFailed } from '#server/http/responses.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the finding routes: GET / lists findings in inbox order filtered by the query
 * parameters of parseFindingQuery, GET /:id answers the detail of the side panel, with the
 * CISA catalog entry of a KEV listed finding when the KEV source is cisa.
 * @param {RouteDeps} deps - Database, clock and KEV source
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/findings
 */
export const createFindingRoutes = ({ db, clock, kevSource }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const query = parseFindingQuery(c.req.query())

    if (!query.ok) {
      return validationFailed(c, query.errors)
    }

    return c.json<FindingView[]>(filterFindings(listFindingViews(db, clock()), query.value))
  })

  routes.get('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    const detail = id === null ? null : getFindingDetail(db, id, clock(), kevSource === 'cisa')

    return detail ? c.json<FindingDetail>(detail) : notFound(c)
  })

  return routes
}
