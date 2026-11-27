import type { Handler } from 'hono'
import * as client from 'openid-client'

import type { LogoutResponse } from '#core/authApiTypes.ts'
import { clearSessionCookie, readSessionCookie } from '#server/auth/oidc/authCookies.ts'
import type { OidcAuthDeps } from '#server/auth/oidc/OidcAuthDeps.ts'
import { setSignedOutCookie } from '#server/auth/oidc/signedOutCookie.ts'
import { deleteSession } from '#server/db/sessionRepository.ts'
import type { Session } from '#server/db/sessionRows.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import { errorText, logSafe } from '#server/logSafe.ts'

/**
 * Builds where the browser goes after the local logout: the issuer end-session endpoint with
 * id_token_hint and the public URL as post_logout_redirect_uri, which travel together because
 * authentik refuses a return address without a hint. Without a session the endpoint gets no
 * parameters and the issuer asks itself; without an endpoint, or when discovery fails, the
 * public URL.
 * @param {Pick<OidcAuthDeps, 'client' | 'publicUrl' | 'log'>} deps - Client, public URL, logger
 * @param {Session | null} session - Deleted session
 * @returns {Promise<string>} - Absolute URL
 */
const logoutRedirect = async (
  { client: oidcClient, publicUrl, log }: Pick<OidcAuthDeps, 'client' | 'publicUrl' | 'log'>,
  session: Session | null,
): Promise<string> => {
  const home = new URL('/', publicUrl).href

  try {
    const configuration = await oidcClient.configuration()

    if (configuration.serverMetadata().end_session_endpoint === undefined) {
      return home
    }

    return client.buildEndSessionUrl(
      configuration,
      session === null ? {} : { id_token_hint: session.idToken, post_logout_redirect_uri: home },
    ).href
  } catch (error) {
    log(`[sieb] OIDC discovery failed at logout: ${errorText(error)}`)
    return home
  }
}

/**
 * Creates POST /auth/logout, mounted behind the same-origin write guard: deletes the session of
 * the cookie, clears the cookie, sets the short-lived signed-out cookie, so the return from the
 * issuer lands on the sign-in page with the signed-out note, and answers where to send the
 * browser next.
 * @param {OidcAuthDeps} deps - Database, client, cookies, public URL, logger
 * @returns {Handler<AppEnv>} - Handler
 */
export const createLogoutHandler =
  (deps: OidcAuthDeps): Handler<AppEnv> =>
  async (c) => {
    const id = readSessionCookie(c, deps.cookies)
    const session = id === undefined ? null : deleteSession(deps.db, id)

    clearSessionCookie(c, deps.cookies)
    setSignedOutCookie(c, deps.cookies)
    if (session !== null) {
      deps.log(`[sieb] logout ${logSafe(session.username)}`)
    }

    c.header('Cache-Control', 'no-store')
    return c.json<LogoutResponse>({ redirect: await logoutRedirect(deps, session) })
  }
