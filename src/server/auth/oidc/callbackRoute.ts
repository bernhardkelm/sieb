import type { Handler } from 'hono'
import * as client from 'openid-client'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { takeLoginTxCookie } from '#server/auth/oidc/authCookies.ts'
import { loginFailedPage } from '#server/auth/oidc/authPages.ts'
import { loginIdentity } from '#server/auth/oidc/loginIdentity.ts'
import { revokeAccessOfRefused, startSession } from '#server/auth/oidc/loginOutcome.ts'
import { errorText, logSafe } from '#server/logSafe.ts'
import { CALLBACK_PATH } from '#server/auth/oidc/oidcClient.ts'
import type { OidcAuthDeps } from '#server/auth/oidc/OidcAuthDeps.ts'

/**
 * Creates GET /auth/callback: opens the sealed pending login of the login cookie, clears the
 * cookie and marks the login consumed whatever the outcome, exchanges the code with the stored
 * state, nonce and PKCE verifier, checks the username and the required group, replaces any
 * previous session of the browser with a new one and redirects to the stored return path. A
 * user refused for the required group loses every session and live personal token. Failures
 * answer a small page and log the reason, never a token.
 * @param {OidcAuthDeps} deps - Database, clock, logger, public URL, OIDC settings, client, login sealer, consumed logins, cookies
 * @returns {Handler<AppEnv>} - Handler
 */
export const createCallbackHandler =
  ({
    db,
    clock,
    log,
    publicUrl,
    oidc,
    client: oidcClient,
    loginTx,
    consumedLogins,
    cookies,
  }: OidcAuthDeps): Handler<AppEnv> =>
  async (c) => {
    /**
     * Logs a refused login and answers the error page.
     * @param {string} reason - Log-safe reason
     * @param {400 | 403 | 503} status - Status code
     * @param {string} message - Text for the user
     * @returns {Response} - Response
     */
    const fail = (reason: string, status: 400 | 403 | 503, message: string): Response => {
      log(`[sieb] login failed: ${reason}`)
      return loginFailedPage(c, status, message)
    }

    const sealed = takeLoginTxCookie(c, cookies)
    const tx = sealed === undefined ? null : await loginTx.open(sealed)
    const fresh = tx !== null && consumedLogins.consume(tx.state, tx.expiresAtMs)
    const idpError = c.req.query('error')

    if (idpError !== undefined) {
      return fail(
        `identity provider answered ${logSafe(idpError)}`,
        400,
        'The identity provider did not complete the login.',
      )
    }

    if (tx === null) {
      return fail('unknown or expired login', 400, 'This login has expired or was already used.')
    }

    if (!fresh) {
      return fail('login cookie used twice', 400, 'This login has expired or was already used.')
    }

    let configuration: client.Configuration
    let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>

    try {
      configuration = await oidcClient.configuration()
    } catch (error) {
      return fail(
        `OIDC discovery failed: ${errorText(error)}`,
        503,
        'The identity provider cannot be reached right now.',
      )
    }

    try {
      tokens = await client.authorizationCodeGrant(
        configuration,
        new URL(`${CALLBACK_PATH}${new URL(c.req.url).search}`, publicUrl),
        { pkceCodeVerifier: tx.codeVerifier, expectedState: tx.state, expectedNonce: tx.nonce },
      )
    } catch (error) {
      return fail(
        `code exchange failed: ${errorText(error)}`,
        400,
        'The login could not be completed.',
      )
    }

    const identity = loginIdentity(tokens.claims(), oidc.requiredGroup)

    if (!identity.ok && identity.error === 'missing_username') {
      return fail(
        'ID token without a usable preferred_username',
        400,
        'The login carried no username.',
      )
    }

    if (!identity.ok) {
      revokeAccessOfRefused(c, { db, clock, log, cookies }, identity.username)
      return fail(
        `${logSafe(identity.username)} is not in the required group`,
        403,
        'Your account is not allowed to use sieb.',
      )
    }

    if (tokens.id_token === undefined) {
      return fail('token response without an ID token', 400, 'The login could not be completed.')
    }

    return startSession(
      c,
      { db, clock, log, oidc, cookies },
      identity,
      tokens.id_token,
      tx.returnTo,
    )
  }
