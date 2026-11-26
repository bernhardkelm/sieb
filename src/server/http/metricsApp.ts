import { Hono } from 'hono'

import type { ErrorBody } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { hostGuard } from '#server/http/hostGuard.ts'
import { pathGuard } from '#server/http/pathGuard.ts'
import { createMetricsRoutes } from '#server/http/routes/metricsRoutes.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'

export interface MetricsAppDeps extends RouteDeps {
  allowedHosts?: readonly string[]
  log?: (message: string) => void
}

/**
 * Creates the app of the separate metrics listener (SIEB_METRICS_PORT): only GET /metrics,
 * which keeps its Host check exemption for scrapes by pod IP, and a JSON 404 for the rest.
 * @param {MetricsAppDeps} deps - Database, clock, KEV source, allowed hosts, logger
 * @returns {Hono<AppEnv>} - App
 */
export const createMetricsApp = ({
  allowedHosts = [],
  log = console.error,
  ...deps
}: MetricsAppDeps): Hono<AppEnv> => {
  const app = new Hono<AppEnv>()

  app.use('*', pathGuard())
  app.use('*', hostGuard(allowedHosts))
  app.route('/metrics', createMetricsRoutes(deps))
  app.notFound((c) => c.json<ErrorBody>({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    log(`[sieb] metrics request ${c.req.path} failed: ${error.message}`)
    return c.json<ErrorBody>({ error: 'internal_error' }, 500)
  })

  return app
}
