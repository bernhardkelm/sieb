import { Hono } from 'hono'

import type { AuthMode, MeResponse } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

/**
 * Creates the session route: GET / answers the acting user and the auth mode, so the client
 * knows whether it can log out and where a 401 should send the user.
 * @param {AuthMode} authMode - Auth mode of the server
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/me
 */
export const createMeRoutes = (authMode: AuthMode): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => c.json<MeResponse>({ username: c.get('actor'), authMode }))

  return routes
}
