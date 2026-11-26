import { Hono } from 'hono'

import { aggregateCves, type CveAggregate } from '#core/cveAggregation.ts'
import { listDecisions } from '#server/db/decisionRepository.ts'
import { listFindingViews } from '#server/db/findingViews.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the CVE routes: GET / aggregates the open findings per vuln_id across images, with
 * ?includeResolved=true also CVEs whose findings are all resolved.
 * @param {RouteDeps} deps - Database and clock
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/cves
 */
export const createCveRoutes = ({ db, clock }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const includeResolved = c.req.query('includeResolved') === 'true'

    const now = clock()

    return c.json<CveAggregate[]>(
      aggregateCves(listFindingViews(db, now, { includeResolved }), listDecisions(db), now),
    )
  })

  return routes
}
