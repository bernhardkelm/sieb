import { Hono } from 'hono'

import type { MeResponse } from '#core/apiTypes.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'

/**
 * Creates the session route: GET / answers the acting user.
 * @returns {Hono<AppEnv>} - Routes, mounted at /api/me
 */
export const createMeRoutes = (): Hono<AppEnv> => {
  const routes = new Hono<AppEnv>()

  routes.get('/', (c) => c.json<MeResponse>({ username: c.get('actor') }))

  return routes
}
