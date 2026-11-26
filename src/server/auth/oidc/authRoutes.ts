import { Hono } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { writeGuard } from '#server/http/writeGuard.ts'
import { createCallbackHandler } from '#server/auth/oidc/callbackRoute.ts'
import { createLoginHandler } from '#server/auth/oidc/loginRoute.ts'
import { createLogoutHandler } from '#server/auth/oidc/logoutRoute.ts'
import type { OidcAuthDeps } from '#server/auth/oidc/OidcAuthDeps.ts'

/**
 * Creates the login routes of the oidc auth mode: GET /login, GET /callback and POST /logout,
 * the logout behind the same-origin JSON write guard.
 * @param {OidcAuthDeps} deps - Database, clock, logger, public URL, OIDC settings, client, login sealer, cookies
 * @returns {Hono<AppEnv>} - Routes, mounted at /auth
 */
export const createAuthRoutes = (deps: OidcAuthDeps): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/login', createLoginHandler(deps))
  routes.get('/callback', createCallbackHandler(deps))
  routes.post('/logout', writeGuard(), createLogoutHandler(deps))

  return routes
}
