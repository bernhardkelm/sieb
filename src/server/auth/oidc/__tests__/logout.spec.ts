// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { LogoutResponse } from '#core/apiTypes.ts'

import { IDP_CLIENT_ID } from './fakeOidcProvider.ts'
import { logIn, oidcTestApp, send, sessionHeaders, setCookieLine } from './oidcTestApp.ts'

/**
 * Posts a same-origin logout as the client does.
 * @param {Parameters<typeof send>[0]} app - App
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<Response>} - Response
 */
const logOut = (
  app: Parameters<typeof send>[0],
  headers: Record<string, string> = {},
): Promise<Response> =>
  send(app, '/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://sieb.example',
      'Sec-Fetch-Site': 'same-origin',
      ...headers,
    },
    body: '{}',
  })

describe('POST /auth/logout', () => {
  it('deletes the session, clears the cookie and answers the end-session URL', async () => {
    const test = await oidcTestApp()
    const { session } = await logIn(test)
    const idToken = String(test.deps.db.prepare('SELECT id_token FROM sessions').get()?.id_token)
    const response = await logOut(test.app, sessionHeaders(session))
    const { redirect } = (await response.json()) as LogoutResponse
    const url = new URL(redirect)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(`${url.origin}${url.pathname}`).toBe('https://idp.test/application/o/sieb/end-session/')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: IDP_CLIENT_ID,
      id_token_hint: idToken,
      post_logout_redirect_uri: 'https://sieb.example/',
    })
    expect(setCookieLine(response, '__Host-sieb_session')).toMatch(/Max-Age=0.*Path=\/.*Secure/)
    expect(test.deps.db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n).toBe(0)
    expect(test.logs).toContain('[sieb] logout alice')
    expect((await send(test.app, '/api/me', { headers: sessionHeaders(session) })).status).toBe(401)
  })

  it('answers the public URL when the issuer has no end-session endpoint', async () => {
    const test = await oidcTestApp()

    test.idp.endSession = false
    const { session } = await logIn(test)
    const response = await logOut(test.app, sessionHeaders(session))

    expect(await response.json()).toEqual({ redirect: 'https://sieb.example/' })
  })

  it('sends a logout without a session to the bare end-session endpoint', async () => {
    const test = await oidcTestApp()
    const response = await logOut(test.app)
    const url = new URL(((await response.json()) as LogoutResponse).redirect)

    expect(response.status).toBe(200)
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: IDP_CLIENT_ID })
  })

  it('refuses cross-site logouts and keeps the session', async () => {
    const test = await oidcTestApp()
    const { session } = await logIn(test)
    const cookie = sessionHeaders(session)
    const foreign = await logOut(test.app, { ...cookie, Origin: 'https://evil.example' })
    const crossSite = await logOut(test.app, { ...cookie, 'Sec-Fetch-Site': 'cross-site' })
    const form = await logOut(test.app, {
      ...cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    const get = await send(test.app, '/auth/logout', { headers: cookie })

    expect([foreign.status, crossSite.status, form.status, get.status]).toEqual([
      403, 403, 415, 404,
    ])
    expect((await send(test.app, '/api/me', { headers: cookie })).status).toBe(200)
  })
})
