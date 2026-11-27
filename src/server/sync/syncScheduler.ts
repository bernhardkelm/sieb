import { errorMessage } from '#core/errorMessage.ts'
import type { SyncService } from '#server/sync/syncService.ts'

export interface SyncScheduler {
  stop: () => void
}

/**
 * Starts a sync right away and then every interval. Overlapping ticks join the running sync, a
 * rejected sync is logged and the next tick tries again.
 * @param {Pick<SyncService, 'syncNow'>} sync - Sync service
 * @param {number} intervalMinutes - Minutes between syncs
 * @param {(message: string) => void} log - Logger
 * @returns {SyncScheduler} - Handle to stop the timer
 */
export const startSyncScheduler = (
  sync: Pick<SyncService, 'syncNow'>,
  intervalMinutes: number,
  log: (message: string) => void = console.error,
): SyncScheduler => {
  /**
   * Starts or joins a sync without letting a rejection escape.
   * @returns {void}
   */
  const tick = (): void => {
    sync.syncNow().catch((error: unknown) => {
      log(`[sieb] scheduled sync failed: ${errorMessage(error)}`)
    })
  }

  tick()
  const timer = setInterval(tick, intervalMinutes * 60_000)

  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
