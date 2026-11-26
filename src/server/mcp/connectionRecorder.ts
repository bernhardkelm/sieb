import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { recordMcpConnection } from '#server/db/mcpConnectionRepository.ts'
import type { McpCaller } from '#server/mcp/mcpCaller.ts'

/** mcp_connections is written at most once per user, authentication kind and this interval */
export const CONNECTION_RECORD_INTERVAL_MS = 5 * 60 * 1000

export interface ConnectionRecorderDeps {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
}

/**
 * Creates the recorder of authenticated MCP requests. It keeps the last write per user and
 * authentication kind in memory, so a burst of requests costs one write, and logs a failed write
 * instead of failing the request.
 * @param {ConnectionRecorderDeps} deps - Database, clock and logger
 * @param {number} intervalMs - Shortest time between two writes of one user and kind
 * @returns {(caller: McpCaller) => void} - Records a caller
 */
export const createConnectionRecorder = (
  { db, clock, log }: ConnectionRecorderDeps,
  intervalMs = CONNECTION_RECORD_INTERVAL_MS,
): ((caller: McpCaller) => void) => {
  const lastWrite = new Map<string, number>()

  return (caller) => {
    const now = clock()
    const key = `${caller.via}:${caller.actor}`
    const previous = lastWrite.get(key)

    if (previous !== undefined && now.getTime() - previous < intervalMs) {
      return
    }

    try {
      recordMcpConnection(db, { username: caller.actor, via: caller.via }, now)
      lastWrite.set(key, now.getTime())
    } catch (error) {
      log(`[sieb] could not record the MCP connection: ${(error as Error).message}`)
    }
  }
}
