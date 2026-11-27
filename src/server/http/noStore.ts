import type { MiddlewareHandler } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'

/**
 * Marks every answer of the routes behind it as not cacheable.
 * @returns {MiddlewareHandler<AppEnv>} - Middleware setting Cache-Control: no-store
 */
export const noStore = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  c.header('Cache-Control', 'no-store')
  await next()
}
