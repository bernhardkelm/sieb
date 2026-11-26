import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { deleteStaleTokens } from '#server/db/apiTokenCleanup.ts'
import { deleteExpiredSessions } from '#server/db/sessionRepository.ts'

export const AUTH_CLEANUP_INTERVAL_MS = 15 * 60 * 1000

export interface AuthCleanup {
  stop: () => void
}

/**
 * Runs the credential cleanup right away and then every interval: expired sessions (lookups
 * delete them lazily too, this catches the ones nobody presents again) and personal token rows
 * revoked or expired more than 90 days ago. Logs what it removed.
 * @param {{ db: DatabaseSync; clock: Clock; log?: (message: string) => void; intervalMs?: number }} deps - Database, clock, logger, interval
 * @returns {AuthCleanup} - Handle to stop the timer
 */
export const startAuthCleanup = ({
  db,
  clock,
  log = console.error,
  intervalMs = AUTH_CLEANUP_INTERVAL_MS,
}: {
  db: DatabaseSync
  clock: Clock
  log?: (message: string) => void
  intervalMs?: number
}): AuthCleanup => {
  /**
   * Runs one cleanup without letting an error escape the timer.
   * @returns {void}
   */
  const tick = (): void => {
    try {
      const now = clock()
      const sessions = deleteExpiredSessions(db, now)
      const tokens = deleteStaleTokens(db, now)

      if (sessions > 0) {
        log(`[sieb] session cleanup removed ${sessions} expired sessions`)
      }

      if (tokens > 0) {
        log(`[sieb] token cleanup removed ${tokens} revoked or expired tokens`)
      }
    } catch (error) {
      log(`[sieb] auth cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  tick()
  const timer = setInterval(tick, intervalMs)

  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
