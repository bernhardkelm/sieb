import type { DatabaseSync } from 'node:sqlite'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import type { Clock } from '#core/clock.ts'
import type { ErrorBody } from '#core/apiTypes.ts'
import type { KevSourceKind } from '#core/kev.ts'
import type { HealthResponse, SourceKind } from '#core/types.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { hostGuard } from '#server/http/hostGuard.ts'
import { DEFAULT_USER_HEADER, identity } from '#server/http/identity.ts'
import { createBulkDecisionRoutes } from '#server/http/routes/bulkDecisionRoutes.ts'
import { createCveRoutes } from '#server/http/routes/cveRoutes.ts'
import { createDecisionRoutes } from '#server/http/routes/decisionRoutes.ts'
import { createFindingRoutes } from '#server/http/routes/findingRoutes.ts'
import { createImageRoutes } from '#server/http/routes/imageRoutes.ts'
import { createLabelRoutes } from '#server/http/routes/labelRoutes.ts'
import { createMeRoutes } from '#server/http/routes/meRoutes.ts'
import { createMetricsRoutes } from '#server/http/routes/metricsRoutes.ts'
import { createStatsRoutes } from '#server/http/routes/statsRoutes.ts'
import { createSyncRoutes } from '#server/http/routes/syncRoutes.ts'
import { useSpa } from '#server/http/spaRoutes.ts'
import { writeGuard } from '#server/http/writeGuard.ts'
import type { SyncService } from '#server/sync/syncService.ts'

export const MAX_BODY_BYTES = 64 * 1024

export interface AppDeps {
  source: SourceKind
  kevSource: KevSourceKind
  db: DatabaseSync
  sync: SyncService
  clock: Clock
  devUser: string | null // acting user without an auth header, null answers anonymous writes 401
  userHeader?: string // request header carrying the authenticated username
  allowedHosts?: readonly string[] // Host values accepted besides loopback
  staticDir?: string | null // built client served after the API, null serves the API only
  log?: (message: string) => void
}

/**
 * Creates the HTTP app: the JSON API under /api with the acting user from the forward-auth
 * header, the unauthenticated /metrics scrape target and, with a static directory, the built
 * client with a fallback to index.html for client routes. Unknown paths get a JSON 404. Every
 * request outside /metrics and /api/health needs an allowed Host, API writes need a same-origin
 * JSON request and API bodies are limited to MAX_BODY_BYTES.
 * @param {AppDeps} deps - Data and KEV source, database, sync service, clock, dev user, user header, allowed hosts, static dir, logger
 * @returns {Hono<AppEnv>} - App
 */
export const createApp = ({
  source,
  kevSource,
  db,
  sync,
  clock,
  devUser,
  userHeader = DEFAULT_USER_HEADER,
  allowedHosts = [],
  staticDir = null,
  log = console.error,
}: AppDeps): Hono<AppEnv> => {
  const app = new Hono<AppEnv>()
  const deps = { db, clock, kevSource }

  app.use('*', hostGuard(allowedHosts))
  app.use('/api/*', writeGuard())
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json<ErrorBody>({ error: 'payload_too_large' }, 413),
    }),
  )
  app.use('/api/*', identity(userHeader, devUser))
  app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok', source }))
  app.route('/api/me', createMeRoutes())
  app.route('/api/findings', createFindingRoutes(deps))
  app.route('/api/images', createImageRoutes(deps))
  app.route('/api/cves', createCveRoutes(deps))
  app.route('/api/decisions/bulk', createBulkDecisionRoutes(deps))
  app.route('/api/decisions', createDecisionRoutes(deps))
  app.route('/api/sync', createSyncRoutes({ ...deps, sync }))
  app.route('/api/stats', createStatsRoutes(deps))
  app.route('/api/labels', createLabelRoutes(deps))
  app.route('/metrics', createMetricsRoutes(deps))

  if (staticDir) {
    useSpa(app, staticDir)
  }

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    log(`[sieb] request ${c.req.method} ${c.req.path} failed: ${error.message}`)
    return c.json({ error: 'internal_error' }, 500)
  })

  return app
}
