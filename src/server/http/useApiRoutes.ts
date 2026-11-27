import type { Hono } from 'hono'

import type { AuthMode, BuildInfo } from '#core/authApiTypes.ts'
import type { HealthResponse, SourceKind } from '#core/types.ts'
import type { CheckContext } from '#server/checks/checkContext.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import { createBulkDecisionRoutes } from '#server/http/routes/bulkDecisionRoutes.ts'
import { createBulkProposalRoutes } from '#server/http/routes/bulkProposalRoutes.ts'
import { createCheckRoutes, createChecksDisabledRoutes } from '#server/http/routes/checkRoutes.ts'
import { createCveRoutes } from '#server/http/routes/cveRoutes.ts'
import { createDecisionRoutes } from '#server/http/routes/decisionRoutes.ts'
import { createFindingRoutes } from '#server/http/routes/findingRoutes.ts'
import { createImageRoutes } from '#server/http/routes/imageRoutes.ts'
import { createInboxRoutes } from '#server/http/routes/inboxRoutes.ts'
import { createLabelRoutes } from '#server/http/routes/labelRoutes.ts'
import { createMcpInfoRoutes } from '#server/http/routes/mcpInfoRoutes.ts'
import { createMeRoutes } from '#server/http/routes/meRoutes.ts'
import { createProposalReviewRoutes } from '#server/http/routes/proposalReviewRoutes.ts'
import { createProposalRoutes } from '#server/http/routes/proposalRoutes.ts'
import { createStatsRoutes } from '#server/http/routes/statsRoutes.ts'
import { createSyncRoutes } from '#server/http/routes/syncRoutes.ts'
import { createMcpDisabledRoutes, createTokenRoutes } from '#server/http/routes/tokenRoutes.ts'
import type { SyncService } from '#server/sync/syncService.ts'

export interface ApiRouteSetup extends RouteDeps {
  source: SourceKind
  sync: SyncService
  authMode: AuthMode
  log: (message: string) => void
  mcpEnabled: boolean // mounts the token routes, otherwise /api/tokens answers 404 mcp_disabled
  publicUrl: string | null // origin for links, null derives it per request
  oauthEnabled: boolean // MCP accepts OAuth tokens besides personal ones
  publicRegistries: readonly string[] // registries whose images count as public
  build: BuildInfo // version and source code link /api/me answers
  checks: CheckContext | null // Auto-check context, null serves the disabled stand-in
}

/**
 * Mounts the health check and the resource routers under /api, the token routes only with MCP
 * and the check routes only with checks.
 * @param {Hono<AppEnv>} app - App, after the /api guards are mounted
 * @param {ApiRouteSetup} setup - Route dependencies, data source, sync service, auth mode, logger, MCP settings, public registries, build info, check context
 * @returns {void}
 */
export const useApiRoutes = (
  app: Hono<AppEnv>,
  {
    db,
    clock,
    kevSource,
    source,
    sync,
    authMode,
    log,
    mcpEnabled,
    publicUrl,
    oauthEnabled,
    publicRegistries,
    build,
    checks,
  }: ApiRouteSetup,
): void => {
  const deps = { db, clock, kevSource }

  app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok', source }))
  app.route('/api/me', createMeRoutes(authMode, build))
  app.route(
    '/api/findings',
    createFindingRoutes({ ...deps, publicRegistries, checksEnabled: checks !== null }),
  )
  app.route('/api/images', createImageRoutes(deps))
  app.route('/api/cves', createCveRoutes(deps))
  app.route('/api/decisions/bulk', createBulkDecisionRoutes(deps))
  app.route('/api/decisions', createDecisionRoutes(deps))
  app.route('/api/proposals', createBulkProposalRoutes({ ...deps, log }))
  app.route('/api/proposals', createProposalRoutes({ ...deps, publicRegistries }))
  app.route('/api/proposals', createProposalReviewRoutes({ ...deps, log }))
  app.route('/api/sync', createSyncRoutes({ ...deps, sync }))
  app.route('/api/stats', createStatsRoutes(deps))
  app.route('/api/labels', createLabelRoutes(deps))
  app.route('/api/inbox', createInboxRoutes({ ...deps, publicUrl }))
  app.route(
    '/api/tokens',
    mcpEnabled ? createTokenRoutes({ ...deps, log }) : createMcpDisabledRoutes(),
  )
  app.route(
    '/api/checks',
    checks === null ? createChecksDisabledRoutes() : createCheckRoutes(checks),
  )
  app.route(
    '/api/mcp-info',
    createMcpInfoRoutes({
      db,
      clock,
      enabled: mcpEnabled,
      publicUrl,
      oauth: oauthEnabled,
      checksEnabled: checks !== null,
    }),
  )
}
