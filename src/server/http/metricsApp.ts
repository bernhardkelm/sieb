import { Hono } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { hostGuard } from '#server/http/hostGuard.ts'
import { pathGuard } from '#server/http/pathGuard.ts'
import { createMetricsRoutes, type MetricsRouteDeps } from '#server/http/routes/metricsRoutes.ts'
import { useErrorHandlers } from '#server/http/useErrorHandlers.ts'

export interface MetricsAppDeps extends MetricsRouteDeps {
  allowedHosts?: readonly string[]
  log?: (message: string) => void
}

/**
 * Creates the app of the separate metrics listener (SIEB_METRICS_PORT): only GET /metrics,
 * which keeps its Host check exemption for scrapes by pod IP, and a JSON 404 for the rest.
 * @param {MetricsAppDeps} deps - Database, clock, KEV source, check context, allowed hosts, logger
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
  useErrorHandlers(app, log, 'metrics request')

  return app
}
