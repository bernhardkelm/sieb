import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import type { CredentialVault } from '#server/credentials/credentialVault.ts'
import type { ProbeTimings } from '#server/credentials/probe/probeFetch.ts'

/** What the credential routes read and write through */
export interface CredentialContext {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
  vault: CredentialVault | null // null without SIEB_CREDENTIALS_KEY: nothing can be stored or used
  fetcherConfigured: boolean // SIEB_FETCHER_SECRET is set and Auto-check is on
  fetch?: typeof globalThis.fetch // replaces the vetted probe fetch of the credential test, for tests
  timings?: ProbeTimings // shorter limits in tests
  testLimits?: { cooldownMs?: number; maxRunning?: number } // test throttle, shorter in tests
}
