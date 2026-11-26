import type { DatabaseSync } from 'node:sqlite'

import type { Clock } from '#core/clock.ts'
import type { AuthCookies } from '#server/auth/oidc/authCookies.ts'
import type { ConsumedLogins } from '#server/auth/oidc/consumedLogins.ts'
import type { LoginTxSeal } from '#server/auth/oidc/loginTxSeal.ts'
import type { OidcClient } from '#server/auth/oidc/oidcClient.ts'
import type { OidcConfig } from '#server/oidcConfigValues.ts'

/** What the login, callback and logout routes of the oidc auth mode work with */
export interface OidcAuthDeps {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
  publicUrl: string // origin the redirect URI and the post-logout redirect derive from
  oidc: OidcConfig
  client: OidcClient
  loginTx: LoginTxSeal
  consumedLogins: ConsumedLogins
  cookies: AuthCookies
}
