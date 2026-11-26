import type { DatabaseSync } from 'node:sqlite'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { JWTVerifyGetKey } from 'jose'
import type { CustomFetch } from 'openid-client'

import type { Clock } from '#core/clock.ts'
import type { AuthMode, ErrorBody } from '#core/apiTypes.ts'
import type { KevSourceKind } from '#core/kev.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import type { HealthResponse, SourceKind } from '#core/types.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { hostGuard } from '#server/http/hostGuard.ts'
import { pathGuard } from '#server/http/pathGuard.ts'
import { securityHeaders } from '#server/http/securityHeaders.ts'
import { DEFAULT_USER_HEADER, identity } from '#server/http/identity.ts'
import { createBulkDecisionRoutes } from '#server/http/routes/bulkDecisionRoutes.ts'
import { createCveRoutes } from '#server/http/routes/cveRoutes.ts'
import { createDecisionRoutes } from '#server/http/routes/decisionRoutes.ts'
import { createFindingRoutes } from '#server/http/routes/findingRoutes.ts'
import { createImageRoutes } from '#server/http/routes/imageRoutes.ts'
import { createInboxRoutes } from '#server/http/routes/inboxRoutes.ts'
import { createLabelRoutes } from '#server/http/routes/labelRoutes.ts'
import { createMcpInfoRoutes } from '#server/http/routes/mcpInfoRoutes.ts'
import { createMeRoutes } from '#server/http/routes/meRoutes.ts'
import { createMetricsRoutes } from '#server/http/routes/metricsRoutes.ts'
import { createProposalRoutes } from '#server/http/routes/proposalRoutes.ts'
import { createStatsRoutes } from '#server/http/routes/statsRoutes.ts'
import { createSyncRoutes } from '#server/http/routes/syncRoutes.ts'
import { createMcpDisabledRoutes, createTokenRoutes } from '#server/http/routes/tokenRoutes.ts'
import { useSpa } from '#server/http/spaRoutes.ts'
import { useOidcAuth } from '#server/http/useOidcAuth.ts'
import { writeGuard } from '#server/http/writeGuard.ts'
import { mcpBodyLimit, mcpOriginGuard } from '#server/mcp/mcpGuards.ts'
import { createMcpRoute } from '#server/mcp/mcpRoute.ts'
import { createProtectedResourceRoutes } from '#server/mcp/protectedResourceRoute.ts'
import { logSafe } from '#server/logSafe.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'
import type { OidcConfig } from '#server/oidcConfigValues.ts'
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
  mcpEnabled?: boolean // mounts /mcp, its OAuth metadata and /api/tokens, off by default
  publicUrl?: string | null // origin for links and the MCP resource, null derives it per request
  mcpAllowedOrigins?: readonly string[] // browser origins /mcp accepts besides the requested host
  oauth?: OAuthConfig | null // null accepts personal tokens only on /mcp
  version?: string // sieb version reported by the MCP server
  jwtKeys?: JWTVerifyGetKey // replaces the discovered OAuth key set, for tests
  authMode?: AuthMode // header by default
  oidc?: OidcConfig | null // login settings, required in oidc mode
  oidcFetch?: CustomFetch // replaces fetch towards the OIDC issuer, for tests
  metricsOnMainPort?: boolean // false when SIEB_METRICS_PORT serves /metrics, ignored in oidc mode
  publicRegistries?: readonly string[] // registries whose images count as public, DEFAULT_PUBLIC_REGISTRIES by default
}

/**
 * Creates the HTTP app: the JSON API under /api with the acting user from the forward-auth
 * header, the unauthenticated /metrics scrape target and, with a static directory, the built
 * client with a fallback to index.html for client routes. Unknown paths get a JSON 404. Raw
 * targets with dot segments answer 400, every response is unframeable and nosniff. Every
 * request outside /metrics and /api/health needs an allowed Host, API writes need a same-origin
 * JSON request and API bodies are limited to MAX_BODY_BYTES. With MCP enabled, /mcp sits outside
 * /api with its own chain (Origin, body limit, bearer token, rate limit) and never reads the
 * forward-auth header; bearer tokens are never accepted under /api. With MCP disabled, /mcp and
 * the OAuth metadata are not mounted and /api/tokens answers 404 mcp_disabled. In oidc mode a
 * session guard right after the host guard replaces the header identity and gates everything
 * but /auth, the health check, /mcp and the icons. /metrics answers 404 here whenever a
 * separate listener serves it, always in oidc mode.
 * @param {AppDeps} deps - Data and KEV source, database, sync service, clock, dev user, user header, allowed hosts, static dir, logger, MCP settings, auth mode and OIDC settings, metrics placement, public registries
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
  mcpEnabled = false,
  publicUrl = null,
  mcpAllowedOrigins = [],
  oauth = null,
  version = '0.0.0',
  jwtKeys,
  authMode = 'header',
  oidc = null,
  oidcFetch,
  metricsOnMainPort = true,
  publicRegistries = DEFAULT_PUBLIC_REGISTRIES,
}: AppDeps): Hono<AppEnv> => {
  const app = new Hono<AppEnv>()
  const deps = { db, clock, kevSource }
  const serveMetrics = authMode === 'header' && metricsOnMainPort

  app.use('*', securityHeaders())
  app.use('*', pathGuard())
  app.use('*', hostGuard(allowedHosts))
  if (!serveMetrics) {
    app.all('/metrics', (c) => c.json<ErrorBody>({ error: 'not_found' }, 404))
  }

  if (authMode === 'oidc') {
    if (oidc === null || publicUrl === null) {
      throw new Error('SIEB_AUTH=oidc needs the OIDC settings and SIEB_PUBLIC_URL')
    }

    useOidcAuth(app, { db, clock, log, publicUrl, oidc, mcpEnabled, fetch: oidcFetch })
  }

  if (mcpEnabled) {
    app.all(
      '/mcp',
      mcpOriginGuard(mcpAllowedOrigins),
      mcpBodyLimit(),
      createMcpRoute({
        ...deps,
        publicRegistries,
        publicUrl,
        oauth,
        version,
        log,
        ...(jwtKeys === undefined ? {} : { jwtKeys }),
      }),
    )
  }

  if (mcpEnabled && oauth !== null && publicUrl !== null) {
    app.route('/.well-known', createProtectedResourceRoutes({ publicUrl, oauth }))
  }

  app.use('/api/*', writeGuard())
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json<ErrorBody>({ error: 'payload_too_large' }, 413),
    }),
  )
  if (authMode === 'header') {
    app.use('/api/*', identity(userHeader, devUser))
  }

  app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok', source }))
  app.route('/api/me', createMeRoutes(authMode))
  app.route('/api/findings', createFindingRoutes({ ...deps, publicRegistries }))
  app.route('/api/images', createImageRoutes(deps))
  app.route('/api/cves', createCveRoutes(deps))
  app.route('/api/decisions/bulk', createBulkDecisionRoutes(deps))
  app.route('/api/decisions', createDecisionRoutes(deps))
  app.route('/api/proposals', createProposalRoutes({ ...deps, publicRegistries, log }))
  app.route('/api/sync', createSyncRoutes({ ...deps, sync }))
  app.route('/api/stats', createStatsRoutes(deps))
  app.route('/api/labels', createLabelRoutes(deps))
  app.route('/api/inbox', createInboxRoutes({ ...deps, publicUrl }))
  app.route(
    '/api/tokens',
    mcpEnabled ? createTokenRoutes({ ...deps, log }) : createMcpDisabledRoutes(),
  )
  app.route(
    '/api/mcp-info',
    createMcpInfoRoutes({ enabled: mcpEnabled, publicUrl, oauth: mcpEnabled && oauth !== null }),
  )
  if (serveMetrics) {
    app.route('/metrics', createMetricsRoutes(deps))
  }

  if (staticDir) {
    useSpa(app, staticDir)
  }

  app.notFound((c) => c.json({ error: 'not_found' }, 404))
  app.onError((error, c) => {
    log(`[sieb] request ${c.req.method} ${logSafe(c.req.path)} failed: ${logSafe(error.message)}`)
    return c.json({ error: 'internal_error' }, 500)
  })

  return app
}
