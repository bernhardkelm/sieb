import type { KevFeedStatus } from '#core/kev.ts'
import type { SyncRun } from '#core/syncRun.ts'

export interface SyncStatusResponse {
  run: SyncRun | null // latest run, possibly still running
  lastFinished: SyncRun | null
  running: boolean
  kevFeed: KevFeedStatus | null // CISA catalog health, null unless SIEB_KEV_SOURCE is cisa
}
