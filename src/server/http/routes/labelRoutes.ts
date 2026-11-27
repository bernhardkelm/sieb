import { Hono } from 'hono'

import type { LabelsResponse } from '#core/findingApiTypes.ts'
import { readFindingLabels } from '#server/db/readFindingLabels.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

/**
 * Creates the label routes: GET / answers whether any open finding has an exposure label, the
 * distinct owner labels of the open findings and the configured KEV source.
 * @param {Pick<RouteDeps, 'db' | 'kevSource'>} deps - Database and KEV source
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/labels
 */
export const createLabelRoutes = ({
  db,
  kevSource,
}: Pick<RouteDeps, 'db' | 'kevSource'>): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => c.json<LabelsResponse>({ ...readFindingLabels(db), kev: kevSource }))

  return routes
}
