import { Hono } from 'hono'

import { METRICS_CONTENT_TYPE, renderMetrics } from '#core/metricsText.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { readMetricsInput } from '#server/metrics/readMetricsInput.ts'

export interface MetricsRouteDeps extends RouteDeps {
  checks?: CheckContext | null // Auto-check context for the worker presence, null while checks are off
}

/**
 * Creates the Prometheus scrape route: GET / renders the suppressions, sync and Auto-check
 * series, without authentication.
 * @param {MetricsRouteDeps} deps - Database, clock and check context
 * @returns {Hono<AppEnv>} - Routes, mounted at /metrics
 */
export const createMetricsRoutes = ({
  db,
  clock,
  checks = null,
}: MetricsRouteDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => {
    const now = clock()
    const workerOnline = checks === null ? null : checks.presence.online(now)

    return c.body(renderMetrics(readMetricsInput(db, now, workerOnline)), 200, {
      'Content-Type': METRICS_CONTENT_TYPE,
    })
  })

  return routes
}
