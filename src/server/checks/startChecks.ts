import type { DatabaseSync } from 'node:sqlite'
import { serve } from '@hono/node-server'

import type { Clock } from '#core/clock.ts'
import { createCheckContext, type CheckContext } from '#server/checks/checkContext.ts'
import { expireAndLog } from '#server/checks/readChecks.ts'
import type { ServerConfig } from '#server/config.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import { createWorkerApp } from '#server/http/workerApp.ts'
import { errorText } from '#server/logSafe.ts'

/** Interval of the timeout sweep, so a lost worker's token is revoked without any request */
export const EXPIRY_INTERVAL_MS = 30 * 1000

export interface RunningChecks {
  context: CheckContext
  stop: () => void
}

/**
 * Starts Auto-check when SIEB_CHECKS_ENABLED is on: the shared check context, the worker
 * listener on SIEB_WORKER_PORT with the fetcher routes behind SIEB_FETCHER_SECRET, and the
 * timeout sweep.
 * @param {{ config: ServerConfig; db: DatabaseSync; clock: Clock; vault: CredentialVault | null }} deps - Configuration, database, clock and credential vault
 * @returns {RunningChecks | null} - Context and stop function, null while checks are off
 */
export const startChecks = ({
  config,
  db,
  clock,
  vault,
}: {
  config: ServerConfig
  db: DatabaseSync
  clock: Clock
  vault: CredentialVault | null
}): RunningChecks | null => {
  if (config.checks === null || config.publicUrl === null) {
    return null
  }

  const context = createCheckContext({
    db,
    clock,
    log: console.log,
    publicRegistries: config.publicRegistries,
    publicUrl: config.publicUrl,
    config: config.checks,
    vault,
  })
  const server = serve(
    {
      fetch: createWorkerApp({
        context,
        secret: config.checks.workerSecret,
        fetcherSecret: config.checks.fetcherSecret,
      }).fetch,
      hostname: config.host,
      port: config.checks.workerPort,
    },
    (info) => {
      console.log(`[sieb] serving /worker on http://${info.address}:${info.port}`)
    },
  )
  const sweep = setInterval(() => {
    try {
      expireAndLog(context)
    } catch (error) {
      console.error(`[sieb] check timeout sweep failed: ${errorText(error)}`)
    }
  }, EXPIRY_INTERVAL_MS)

  sweep.unref()

  return {
    context,
    stop: () => {
      clearInterval(sweep)
      server.close()
    },
  }
}
