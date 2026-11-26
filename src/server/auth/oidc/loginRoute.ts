import type { Handler } from 'hono'
import * as client from 'openid-client'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { setLoginTxCookie } from '#server/auth/oidc/authCookies.ts'
import { loginFailedPage } from '#server/auth/oidc/authPages.ts'
import { errorText } from '#server/logSafe.ts'
import { CALLBACK_PATH, OIDC_SCOPES } from '#server/auth/oidc/oidcClient.ts'
import type { OidcAuthDeps } from '#server/auth/oidc/OidcAuthDeps.ts'
import { safeReturnPath } from '#server/auth/oidc/returnPath.ts'

/**
 * Creates GET /auth/login: starts an authorization code flow with PKCE S256, state and nonce,
 * seals them with the return path into the login cookie, and redirects to the issuer. The
 * redirect URI derives from the public URL, never from request headers. A failed discovery
 * answers 503.
 * @param {OidcAuthDeps} deps - Client, login sealer, cookies, public URL, logger
 * @returns {Handler<AppEnv>} - Handler
 */
export const createLoginHandler =
  ({ client: oidcClient, loginTx, cookies, publicUrl, log }: OidcAuthDeps): Handler<AppEnv> =>
  async (c) => {
    const returnTo = safeReturnPath(c.req.query('return'))
    let configuration: client.Configuration

    try {
      configuration = await oidcClient.configuration()
    } catch (error) {
      log(`[sieb] OIDC discovery failed: ${errorText(error)}`)
      return loginFailedPage(c, 503, 'The identity provider cannot be reached right now.')
    }

    const codeVerifier = client.randomPKCECodeVerifier()
    const state = client.randomState()
    const nonce = client.randomNonce()
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: new URL(CALLBACK_PATH, publicUrl).href,
      scope: OIDC_SCOPES.join(' '),
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    })

    setLoginTxCookie(c, cookies, await loginTx.seal({ state, nonce, codeVerifier, returnTo }))
    c.header('Cache-Control', 'no-store')
    return c.redirect(url.href, 302)
  }
