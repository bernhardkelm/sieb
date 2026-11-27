import type { DatabaseSync } from 'node:sqlite'
import type { MiddlewareHandler } from 'hono'

import type { Clock } from '#core/clock.ts'
import type { ErrorBody } from '#core/errorApiTypes.ts'
import { readSessionCookie, type AuthCookies } from '#server/auth/oidc/authCookies.ts'
import { hasSignedOutCookie } from '#server/auth/oidc/signedOutCookie.ts'
import { findSession } from '#server/db/sessionRepository.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { sessionAccessOf } from '#server/http/sessionAccess.ts'

/**
 * Creates the access gate of the oidc auth mode, mounted right after the host guard. A valid
 * session cookie sets the actor for every request; without one only public paths pass, /api
 * and other files answer 401 and page navigations redirect to the sign-in page /auth/signin
 * with the path and query as return target, plus signedOut=1 while the signed-out cookie of a
 * recent logout is present. No request header is ever taken as identity here.
 * @param {{ db: DatabaseSync; clock: Clock; cookies: AuthCookies; mcpEnabled: boolean }} deps - Database, clock, cookie settings, MCP flag
 * @returns {MiddlewareHandler<AppEnv>} - Middleware
 */
export const sessionGuard =
  ({
    db,
    clock,
    cookies,
    mcpEnabled,
  }: {
    db: DatabaseSync
    clock: Clock
    cookies: AuthCookies
    mcpEnabled: boolean
  }): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const access = sessionAccessOf(c.req.method, c.req.path, mcpEnabled)

    if (access === 'public') {
      c.set('actor', null)
      await next()
      return
    }

    const id = readSessionCookie(c, cookies)
    const session = id === undefined ? null : findSession(db, id, clock())

    if (session !== null) {
      c.set('actor', session.username)
      await next()
      return
    }

    if (access === 'page') {
      const url = new URL(c.req.url)
      const signedOut = hasSignedOutCookie(c, cookies) ? '&signedOut=1' : ''

      c.header('Cache-Control', 'no-store')
      return c.redirect(
        `/auth/signin?return=${encodeURIComponent(`${url.pathname}${url.search}`)}${signedOut}`,
        302,
      )
    }

    return c.json<ErrorBody>({ error: 'unauthorized' }, 401)
  }
