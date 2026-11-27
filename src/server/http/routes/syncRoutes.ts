import { Hono } from 'hono'

import type { SyncStatusResponse } from '#core/syncApiTypes.ts'
import type { SyncRun } from '#core/syncRun.ts'
import { readKevFeedStatus } from '#server/db/kevFeedRepository.ts'
import { latestSyncRun } from '#server/db/syncRunRepository.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { RouteDeps } from '#server/http/RouteDeps.ts'
import type { SyncService } from '#server/sync/syncService.ts'

/**
 * Creates the sync routes: GET / answers the latest and the latest finished run and, for the
 * cisa KEV source, the health of the stored catalog; POST / runs a sync, or joins the running
 * one, and answers the finished run, failed runs included.
 * @param {RouteDeps & { sync: SyncService }} deps - Database, clock, KEV source and sync service
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/sync
 */
export const createSyncRoutes = ({
  db,
  clock,
  kevSource,
  sync,
}: RouteDeps & { sync: SyncService }): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) =>
    c.json<SyncStatusResponse>({
      run: sync.latestRun(),
      lastFinished: latestSyncRun(db, { finished: true }),
      running: sync.isRunning(),
      kevFeed: kevSource === 'cisa' ? readKevFeedStatus(db, clock()) : null,
    }),
  )

  routes.post('/', async (c) => c.json<SyncRun>(await sync.syncNow()))

  return routes
}
