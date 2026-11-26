import { serve } from '@hono/node-server'

import { readAppVersion } from '#server/appVersion.ts'
import { startAuthCleanup } from '#server/auth/authCleanup.ts'
import { systemClock } from '#server/clock.ts'
import { readConfig } from '#server/config.ts'
import { readKevCatalogIds } from '#server/db/kevCatalogRepository.ts'
import { openDatabase } from '#server/db/openDatabase.ts'
import { createApp } from '#server/http/createApp.ts'
import { createMetricsApp } from '#server/http/metricsApp.ts'
import { startKevCatalog } from '#server/kev/startKevCatalog.ts'
import { createSource } from '#server/sources/createSource.ts'
import { backfillMockStats } from '#server/sources/mock/backfillMockStats.ts'
import { startSyncScheduler } from '#server/sync/syncScheduler.ts'
import { startupWarnings } from '#server/startupWarnings.ts'
import { createSyncService } from '#server/sync/syncService.ts'

/**
 * Opens the database, starts the sync scheduler, the KEV catalog refreshes and the HTTP server
 * with the configuration from the environment, plus the /metrics listener with
 * SIEB_METRICS_PORT and the session and token cleanup, seeds synthetic stats history after
 * the first mock sync, and shuts all of it down on SIGINT and SIGTERM.
 * @returns {void}
 */
const main = (): void => {
  const config = readConfig(process.env, process.cwd())
  const clock = systemClock
  const db = openDatabase(config.dbPath)
  const source = createSource(config, clock, () => readKevCatalogIds(db))
  const sync = createSyncService({ db, source, clock })
  const app = createApp({
    source: config.source,
    kevSource: config.kevSource,
    db,
    sync,
    clock,
    devUser: config.devUser,
    userHeader: config.userHeader,
    allowedHosts: config.allowedHosts,
    staticDir: config.staticDir,
    publicUrl: config.publicUrl,
    mcpAllowedOrigins: config.mcpAllowedOrigins,
    mcpEnabled: config.mcpEnabled,
    oauth: config.oauth,
    version: readAppVersion(),
    authMode: config.authMode,
    oidc: config.oidc,
    metricsOnMainPort: config.metricsPort === null,
    publicRegistries: config.publicRegistries,
  })

  const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
    const client = config.staticDir ? ', serving dist/' : ''

    console.log(
      `[sieb] listening on http://${info.address}:${info.port} ` +
        `(source ${config.source}, KEV ${config.kevSource}${client})`,
    )
  })
  const metricsServer =
    config.metricsPort === null
      ? null
      : serve(
          {
            fetch: createMetricsApp({
              db,
              clock,
              kevSource: config.kevSource,
              allowedHosts: config.allowedHosts,
            }).fetch,
            hostname: config.host,
            port: config.metricsPort,
          },
          (info) => {
            console.log(`[sieb] serving /metrics on http://${info.address}:${info.port}`)
          },
        )
  const authCleanup = startAuthCleanup({ db, clock })

  console.log(`[sieb] auth mode ${config.authMode}`)
  for (const warning of startupWarnings(config)) {
    console.warn(warning)
  }

  if (!config.mcpEnabled) {
    console.log('[sieb] MCP disabled, set SIEB_MCP_ENABLED=true to serve /mcp and /api/tokens')
  }

  const scheduler = startSyncScheduler(sync, config.syncIntervalMinutes)
  const kevCatalog = startKevCatalog({ config, db, clock, sync })

  if (config.source === 'mock') {
    sync
      .syncNow()
      .then(() => {
        const seeded = backfillMockStats(db, config.source, clock())

        if (seeded > 0) {
          console.log(`[sieb] seeded ${seeded} synthetic stats snapshots`)
        }
      })
      .catch((error: unknown) => {
        console.error(
          `[sieb] stats backfill failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      })
  }

  /**
   * Stops the schedulers, closes the server and the database, then exits.
   * @returns {void}
   */
  const shutdown = (): void => {
    scheduler.stop()
    kevCatalog?.stop()
    authCleanup.stop()
    metricsServer?.close()
    server.close(() => {
      db.close()
      process.exit(0)
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

try {
  main()
} catch (error) {
  console.error(`[sieb] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
