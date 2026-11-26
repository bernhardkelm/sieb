import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import type { KevSourceKind } from '#core/kev.ts'

/** What the resource routers read and write through */
export interface RouteDeps {
  db: DatabaseSync
  clock: Clock
  kevSource: KevSourceKind
}
