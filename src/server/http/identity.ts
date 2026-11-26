import type { Context, MiddlewareHandler } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'

export const DEFAULT_USER_HEADER = 'X-authentik-username'

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * Resolves the acting user: the forward-auth username header, trusted because the proxy
 * overwrites it on every request, else the dev user.
 * @param {Headers} headers - Request headers
 * @param {string} userHeader - Name of the username header
 * @param {string | null} devUser - Fallback user outside production, null disables it
 * @returns {string | null} - Username, null when anonymous
 */
export const readActor = (
  headers: Headers,
  userHeader: string,
  devUser: string | null,
): string | null => headers.get(userHeader)?.trim() || devUser

/**
 * Creates the middleware that stores the acting user and answers 401 for writes without one.
 * Reads stay open, so anonymous clients can still list findings.
 * @param {string} userHeader - Name of the username header
 * @param {string | null} devUser - Fallback user outside production
 * @returns {MiddlewareHandler<AppEnv>} - Middleware
 */
export const identity =
  (userHeader: string, devUser: string | null): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const actor = readActor(c.req.raw.headers, userHeader, devUser)

    if (actor === null && !READ_METHODS.includes(c.req.method)) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    c.set('actor', actor)
    await next()
  }

/**
 * Returns the acting user of a write route.
 * @param {Context<AppEnv>} c - Request context
 * @returns {string} - Username
 * @throws {Error} - When the identity middleware let an anonymous write through
 */
export const requireActor = (c: Context<AppEnv>): string => {
  const actor = c.get('actor')

  if (actor === null) {
    throw new Error('write route reached without an actor')
  }

  return actor
}
