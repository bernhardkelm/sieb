import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import { WORKER_ONLINE_MS } from '#core/checkLimits.ts'
import type { CheckConfig } from '#server/checkConfigValues.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { MCP_PATH } from '#server/mcp/mcpEndpointUrl.ts'
import type { PullProber } from '#server/visibility/pullProber.ts'

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
  fetcherConfigured: boolean // SIEB_FETCHER_SECRET is set, the fetcher routes are served
  privateVault: CredentialVault | null // vault of usable credentials, null without the key or the fetcher
  pullProber: PullProber | null // probes own images before queueing, null in mock mode
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
 * Creates the shared check context of both listeners. Stored credentials make private images
 * eligible only with both the vault and the fetcher secret, since only the fetcher pulls them.
 * @param {{ db: DatabaseSync; clock: Clock; log: (message: string) => void; publicRegistries: readonly string[]; publicUrl: string; config: Pick<CheckConfig, 'timeoutSeconds' | 'maxTurns'> & { fetcherSecret?: string | null }; vault?: CredentialVault | null; pullProber?: PullProber | null }} deps - Database, clock, logger, public registries, public origin, check settings, credential vault and pull prober
 * @returns {CheckContext} - Context
 */
export const createCheckContext = ({
  db,
  clock,
  log,
  publicRegistries,
  publicUrl,
  config,
  vault = null,
  pullProber = null,
}: {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
  publicRegistries: readonly string[]
  publicUrl: string
  config: Pick<CheckConfig, 'timeoutSeconds' | 'maxTurns'> & { fetcherSecret?: string | null }
  vault?: CredentialVault | null
  pullProber?: PullProber | null
}): CheckContext => ({
  db,
  clock,
  log,
  publicRegistries,
  mcpUrl: new URL(MCP_PATH, publicUrl).href,
  timeoutSeconds: config.timeoutSeconds,
  maxTurns: config.maxTurns,
  presence: createWorkerPresence(),
  fetcherConfigured: (config.fetcherSecret ?? null) !== null,
  privateVault: (config.fetcherSecret ?? null) === null ? null : vault,
  pullProber,
})
