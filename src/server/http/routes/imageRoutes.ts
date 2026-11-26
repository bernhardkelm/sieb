import { Hono } from 'hono'

import { aggregateImages, type ImageAggregate } from '#core/imageAggregation.ts'
import { listFindingViews } from '#server/db/findingViews.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the image routes: GET / aggregates the open findings per image_ref, with
 * ?includeResolved=true also images whose findings are all resolved.
 * @param {RouteDeps} deps - Database and clock
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/images
 */
export const createImageRoutes = ({ db, clock }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const includeResolved = c.req.query('includeResolved') === 'true'

    return c.json<ImageAggregate[]>(
      aggregateImages(listFindingViews(db, clock(), { includeResolved })),
    )
  })

  return routes
}
