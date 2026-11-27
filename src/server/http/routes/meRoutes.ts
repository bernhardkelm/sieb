import { Hono } from 'hono'

import type { AuthMode, BuildInfo, MeResponse } from '#core/authApiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

/**
 * Creates the session route: GET / answers the acting user and the auth mode, so the client
 * knows whether it can log out and where a 401 should send the user, plus the version and source
 * code link of the running build, kept behind the session unlike the health check.
 * @param {AuthMode} authMode - Auth mode of the server
 * @param {BuildInfo} build - Version and source code link
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/me
 */
export const createMeRoutes = (authMode: AuthMode, build: BuildInfo): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => c.json<MeResponse>({ username: c.get('actor'), authMode, ...build }))

  return routes
}
