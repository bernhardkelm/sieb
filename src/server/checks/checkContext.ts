import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { WORKER_ONLINE_MS } from '#core/checkLimits.ts'
import type { CheckConfig } from '#server/checkConfigValues.ts'
import { MCP_PATH } from '#server/mcp/mcpEndpointUrl.ts'

/** When the worker last reached sieb, kept in memory */
export interface WorkerPresence {
  seen: (now: Date) => void // records an authenticated worker request
  online: (now: Date) => boolean // whether the last one is at most WORKER_ONLINE_MS old
}

/** What the check routes of the client and the worker share */
export interface CheckContext {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
  publicRegistries: readonly string[]
  mcpUrl: string // absolute /mcp URL handed to the worker
  timeoutSeconds: number
  maxTurns: number
  presence: WorkerPresence
}

/**
 * Creates the in-memory record of the last authenticated worker request.
 * @returns {WorkerPresence} - Presence, offline until the first request
 */
export const createWorkerPresence = (): WorkerPresence => {
  let lastSeen: number | null = null

  return {
    seen: (now) => {
      lastSeen = now.getTime()
    },
    online: (now) => lastSeen !== null && now.getTime() - lastSeen <= WORKER_ONLINE_MS,
  }
}

/**
 * Creates the shared check context of both listeners.
 * @param {{ db: DatabaseSync; clock: Clock; log: (message: string) => void; publicRegistries: readonly string[]; publicUrl: string; config: Pick<CheckConfig, 'timeoutSeconds' | 'maxTurns'> }} deps - Database, clock, logger, public registries, public origin and check settings
 * @returns {CheckContext} - Context
 */
export const createCheckContext = ({
  db,
  clock,
  log,
  publicRegistries,
  publicUrl,
  config,
}: {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
  publicRegistries: readonly string[]
  publicUrl: string
  config: Pick<CheckConfig, 'timeoutSeconds' | 'maxTurns'>
}): CheckContext => ({
  db,
  clock,
  log,
  publicRegistries,
  mcpUrl: new URL(MCP_PATH, publicUrl).href,
  timeoutSeconds: config.timeoutSeconds,
  maxTurns: config.maxTurns,
  presence: createWorkerPresence(),
})
