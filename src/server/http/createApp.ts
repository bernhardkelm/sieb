import type { DatabaseSync } from 'node:sqlite'
import { Hono } from 'hono'
import type { JWTVerifyGetKey } from 'jose'
import type { CustomFetch } from 'openid-client'

import type { Clock } from '#core/clock.ts'
import type { AuthMode, ErrorBody } from '#core/apiTypes.ts'
import type { KevSourceKind } from '#core/kev.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import type { SourceKind } from '#core/types.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { hostGuard } from '#server/http/hostGuard.ts'
import { DEFAULT_USER_HEADER } from '#server/http/identity.ts'
import { pathGuard } from '#server/http/pathGuard.ts'
import { createMetricsRoutes } from '#server/http/routes/metricsRoutes.ts'
import { securityHeaders } from '#server/http/securityHeaders.ts'
import { useSpa } from '#server/http/spaRoutes.ts'
import { useApiGuards } from '#server/http/useApiGuards.ts'
import { useApiRoutes } from '#server/http/useApiRoutes.ts'
import { useErrorHandlers } from '#server/http/useErrorHandlers.ts'
import { useMcpEndpoint } from '#server/http/useMcpEndpoint.ts'
import { useOidcAuth } from '#server/http/useOidcAuth.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'
import type { OidcConfig } from '#server/oidcConfigValues.ts'
import { sourceCodeUrlOf } from '#server/sourceCodeUrl.ts'
import type { SyncService } from '#server/sync/syncService.ts'

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
  version?: string // sieb version reported by the MCP server and /api/me
  jwtKeys?: JWTVerifyGetKey // replaces the discovered OAuth key set, for tests
  authMode?: AuthMode // header by default
  oidc?: OidcConfig | null // login settings, required in oidc mode
  oidcFetch?: CustomFetch // replaces fetch towards the OIDC issuer, for tests
  metricsOnMainPort?: boolean // false when SIEB_METRICS_PORT serves /metrics, ignored in oidc mode
  publicRegistries?: readonly string[] // registries whose images count as public, DEFAULT_PUBLIC_REGISTRIES by default
  sourceCodeUrl?: string | null // source code link of a fork, null links the upstream release tag
  checks?: CheckContext | null // Auto-check context shared with the worker listener, null disables /api/checks writes
}

/**
 * Creates the HTTP app. The mount order is load-bearing, Hono runs middleware in mount order:
 * 1. securityHeaders, every response is unframeable and nosniff
 * 2. pathGuard, raw targets with dot segments answer 400
 * 3. hostGuard, every request outside /metrics and /api/health needs an allowed Host
 * 4. /metrics answers 404 whenever a separate listener serves it, always in oidc mode
 * 5. oidc mode only: the session guard replaces the header identity and gates everything but
 *    /auth, the health check, /mcp and the icons, then the login routes under /auth
 * 6. MCP enabled only: /mcp outside /api with its own chain (Origin, body limit, bearer token,
 *    rate limit), never reading the forward-auth header, and the OAuth metadata under /.well-known
 * 7. /api guards: same-origin JSON writes, MAX_BODY_BYTES bodies, header mode identity
 * 8. /api routes, /api/tokens answers 404 mcp_disabled without MCP and /api/checks writes 404
 *    checks_disabled without checks; bearer tokens never pass here
 * 9. /metrics scrape target, unauthenticated, when served on this port
 * 10. with a static directory, the built client with a fallback to index.html for client routes
 * 11. JSON 404 for unknown paths and a logged JSON 500 for errors
 * @param {AppDeps} deps - Data and KEV source, database, sync service, clock, dev user, user header, allowed hosts, static dir, logger, MCP settings, version, auth mode and OIDC settings, metrics placement, public registries, source code link, check context
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
  sourceCodeUrl = null,
  checks = null,
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
    useMcpEndpoint(app, {
      ...deps,
      allowedOrigins: mcpAllowedOrigins,
      publicRegistries,
      publicUrl,
      oauth,
      version,
      log,
      checksEnabled: checks !== null,
      ...(jwtKeys === undefined ? {} : { jwtKeys }),
    })
  }

  useApiGuards(app, { authMode, userHeader, devUser })
  useApiRoutes(app, {
    ...deps,
    source,
    sync,
    authMode,
    log,
    mcpEnabled,
    publicUrl,
    oauthEnabled: mcpEnabled && oauth !== null,
    publicRegistries,
    build: { version, sourceCodeUrl: sourceCodeUrlOf(version, sourceCodeUrl) },
    checks,
  })
  if (serveMetrics) {
    app.route('/metrics', createMetricsRoutes({ ...deps, checks }))
  }

  if (staticDir) {
    useSpa(app, staticDir)
  }

  useErrorHandlers(app, log)

  return app
}
