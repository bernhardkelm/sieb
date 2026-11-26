import type { Handler } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { readSessionCookie } from '#server/auth/oidc/authCookies.ts'
import { setAuthPageHeaders } from '#server/auth/oidc/authPageHeaders.ts'
import type { OidcAuthDeps } from '#server/auth/oidc/OidcAuthDeps.ts'
import { safeReturnPath } from '#server/auth/oidc/returnPath.ts'
import { clearSignedOutCookie } from '#server/auth/oidc/signedOutCookie.ts'
import { SIGN_IN_STYLE, signInPageHtml } from '#server/auth/oidc/signInPage.ts'
import { findSession } from '#server/db/sessionRepository.ts'

/**
 * Creates GET /auth/signin, where the session guard sends page navigations without a session:
 * a static page whose button starts the login with the validated return path, so neither an
 * expired session nor the return from the issuer's logout logs the user back in unasked.
 * signedOut=1 adds the signed-out note; the signed-out cookie is cleared. A browser with a valid
 * session goes straight to the return path.
 * @param {OidcAuthDeps} deps - Database, clock, cookies, OIDC settings
 * @returns {Handler<AppEnv>} - Handler
 */
export const createSignInHandler =
  ({ db, clock, cookies, oidc }: OidcAuthDeps): Handler<AppEnv> =>
  (c) => {
    const returnTo = safeReturnPath(c.req.query('return'))
    const id = readSessionCookie(c, cookies)

    if (id !== undefined && findSession(db, id, clock()) !== null) {
      c.header('Cache-Control', 'no-store')
      return c.redirect(returnTo, 302)
    }

    clearSignedOutCookie(c, cookies)
    setAuthPageHeaders(c, SIGN_IN_STYLE)
    return c.html(
      signInPageHtml({
        returnTo,
        displayName: oidc.displayName,
        signedOut: c.req.query('signedOut') === '1',
      }),
    )
  }
