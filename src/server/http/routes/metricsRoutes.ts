import { Hono } from 'hono'

import { METRICS_CONTENT_TYPE, renderMetrics } from '#core/metricsText.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { readMetricsInput } from '#server/metrics/readMetricsInput.ts'

/**
 * Creates the Prometheus scrape route: GET / renders the suppressions and sync gauges, without
 * authentication.
 * @param {RouteDeps} deps - Database and clock
 * @returns {Hono<AppEnv>} - Routes, mounted at /metrics
 */
export const createMetricsRoutes = ({ db, clock }: RouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) =>
    c.body(renderMetrics(readMetricsInput(db, clock())), 200, {
      'Content-Type': METRICS_CONTENT_TYPE,
    }),
  )

  return routes
}
