import type { DatabaseSync } from 'node:sqlite'
import type { Hono } from 'hono'
import type { CustomFetch } from 'openid-client'

import type { Clock } from '#core/clock.ts'
import { authCookiesFor } from '#server/auth/oidc/authCookies.ts'
import { createAuthRoutes } from '#server/auth/oidc/authRoutes.ts'
import { createConsumedLogins } from '#server/auth/oidc/consumedLogins.ts'
import { createLoginTxSeal } from '#server/auth/oidc/loginTxSeal.ts'
import { createOidcClient } from '#server/auth/oidc/oidcClient.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { sessionGuard } from '#server/http/sessionGuard.ts'
import type { OidcConfig } from '#server/oidcConfigValues.ts'

export interface OidcAuthSetup {
  db: DatabaseSync
  clock: Clock
  log: (message: string) => void
  publicUrl: string
  oidc: OidcConfig
  mcpEnabled: boolean
  fetch?: CustomFetch // replaces fetch towards the issuer, for tests
}

/**
 * Mounts the oidc auth mode on the app, right after the host guard: the session guard for every
 * request and the login routes under /auth.
 * @param {Hono<AppEnv>} app - App, with only the host guard mounted so far
 * @param {OidcAuthSetup} setup - Database, clock, logger, public URL, OIDC settings, MCP flag, optional fetch
 * @returns {void}
 */
export const useOidcAuth = (
  app: Hono<AppEnv>,
  { db, clock, log, publicUrl, oidc, mcpEnabled, fetch }: OidcAuthSetup,
): void => {
  const cookies = authCookiesFor(publicUrl)
  const client = createOidcClient({
    issuer: oidc.issuer,
    clientId: oidc.clientId,
    clientSecret: oidc.clientSecret,
    now: () => clock().getTime(),
    ...(fetch === undefined ? {} : { fetch }),
  })

  app.use('*', sessionGuard({ db, clock, cookies, mcpEnabled }))
  app.route(
    '/auth',
    createAuthRoutes({
      db,
      clock,
      log,
      publicUrl,
      oidc,
      client,
      loginTx: createLoginTxSeal({ clock }),
      consumedLogins: createConsumedLogins({ clock }),
      cookies,
    }),
  )
}
