import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { errorMessage } from '#core/errorMessage.ts'
import type { ServerConfig } from '#server/config.ts'
import { fetchKevFeed } from '#server/kev/fetchKevFeed.ts'
import { createKevRefresher } from '#server/kev/kevRefresher.ts'
import { startKevRefreshSchedule, type KevRefreshSchedule } from '#server/kev/kevRefreshSchedule.ts'
import { readMockKevFeed } from '#server/sources/mock/mockKevFeed.ts'
import type { SyncService } from '#server/sync/syncService.ts'

export interface KevCatalogDeps {
  config: Pick<ServerConfig, 'source' | 'kevSource' | 'kevUrl'>
  db: DatabaseSync
  clock: Clock
  sync: Pick<SyncService, 'syncNow'>
  log?: (message: string) => void
}

/**
 * Starts the catalog refreshes of the cisa KEV source. Live sources fetch SIEB_KEV_URL and sync
 * after every stored catalog, so new listings show up without waiting for the next scheduled
 * sync. Mock mode loads the fixture catalog on every start instead and never touches the
 * network; it skips the extra sync, which would flip the fixture state.
 * @param {KevCatalogDeps} deps - Configuration, database, clock, sync service, logger
 * @returns {KevRefreshSchedule | null} - Handle to stop the refreshes, null for other KEV sources
 */
export const startKevCatalog = ({
  config,
  db,
  clock,
  sync,
  log = console.error,
}: KevCatalogDeps): KevRefreshSchedule | null => {
  if (config.kevSource !== 'cisa') {
    return null
  }

  const mock = config.source === 'mock'
  const refresher = createKevRefresher({
    db,
    clock,
    log,
    loadFeed: mock ? () => readMockKevFeed() : () => fetchKevFeed(config.kevUrl),
    onUpdated: mock
      ? undefined
      : () => {
          sync.syncNow().catch((error: unknown) => {
            log(`[sieb] sync after KEV update failed: ${errorMessage(error)}`)
          })
        },
  })

  return startKevRefreshSchedule(refresher, { db, clock, force: mock })
}
