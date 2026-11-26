// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { insertToken, listOwnTokens } from '#server/db/apiTokenRepository.ts'
import { hashSessionId } from '#server/db/sessionRepository.ts'

import { IDP_CLIENT_ID } from './fakeOidcProvider.ts'
import {
  authorize,
  logIn,
  oidcTestApp,
  send,
  sessionHeaders,
  setCookieLine,
  setCookies,
  startLogin,
  type OidcTestApp,
} from './oidcTestApp.ts'

/**
 * Sends a callback with a login cookie.
 * @param {OidcTestApp} test - Test app
 * @param {string} path - Callback path and query
 * @param {string} txId - Login cookie value
 * @returns {Promise<Response>} - Response
 */
const callback = (test: OidcTestApp, path: string, txId: string): Promise<Response> =>
  send(test.app, path, { headers: { Cookie: `__Host-sieb_login=${txId}` } })

/**
 * Counts the stored sessions.
 * @param {OidcTestApp} test - Test app
 * @returns {number} - Count
 */
const sessionCount = ({ deps }: OidcTestApp): number =>
  Number(deps.db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n)

describe('GET /auth/login', () => {
  it('redirects to the issuer with PKCE S256, state, nonce and the login cookie', async () => {
    const { app } = await oidcTestApp()
    const response = await send(app, '/auth/login?return=/inbox')
    const location = new URL(response.headers.get('location') ?? '')
    const params = Object.fromEntries(location.searchParams)
    const cookie = setCookieLine(response, '__Host-sieb_login')

    expect(response.status).toBe(302)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://idp.test/application/o/authorize/',
    )
    expect(params).toMatchObject({
      client_id: IDP_CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'https://sieb.example/auth/callback',
      scope: 'openid profile email groups',
      code_challenge_method: 'S256',
    })
    expect(params.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(params.state?.length).toBeGreaterThan(20)
    expect(params.nonce?.length).toBeGreaterThan(20)
    expect(cookie).toMatch(
      /^__Host-sieb_login=[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/,
    )
    expect(cookie).toContain('Max-Age=600')
    expect(cookie).toContain('Path=/;')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('answers 503 and logs while discovery fails, retrying after 30 s', async () => {
    const test = await oidcTestApp()

    test.idp.down = true
    const failed = await send(test.app, '/auth/login')
    test.idp.down = false
    const cached = await send(test.app, '/auth/login')
    test.now.ms += 30 * 1000
    const recovered = await send(test.app, '/auth/login')
    await send(test.app, '/auth/login')

    expect(failed.status).toBe(503)
    expect(await failed.text()).toContain('href="/auth/login"')
    expect(test.logs.some((line) => line.startsWith('[sieb] OIDC discovery failed'))).toBe(true)
    expect(cached.status).toBe(503)
    expect(recovered.status).toBe(302)
    expect(test.idp.discoveries).toBe(2)
  })
})

describe('GET /auth/callback', () => {
  it('creates a session with the cookie attributes and redirects to the return path', async () => {
    const test = await oidcTestApp()
    const { callback: response, session } = await logIn(test, '?return=%2Ffindings%3Fsev%3Dhigh')
    const line = setCookieLine(response, '__Host-sieb_session')
    const row = test.deps.db.prepare('SELECT * FROM sessions').get()

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/findings?sev=high')
    expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(line).toContain('Max-Age=43200')
    expect(line).toContain('Path=/')
    expect(line).toContain('HttpOnly')
    expect(line).toContain('Secure')
    expect(line).toContain('SameSite=Lax')
    expect(line).not.toContain('Domain')
    expect(setCookieLine(response, '__Host-sieb_login')).toContain('Max-Age=0')
    expect(row).toMatchObject({
      id_hash: hashSessionId(session),
      username: 'alice',
      groups: '["sieb-users"]',
      created_at: '2026-06-01T12:00:00.000Z',
      expires_at: '2026-06-02T00:00:00.000Z',
    })
    expect(String(row?.id_token).split('.')).toHaveLength(3)
    expect(test.logs).toContain('[sieb] login alice')
    expect(JSON.stringify(test.logs)).not.toContain(String(row?.id_token))
  })

  it('uses the plain cookie names without Secure over http', async () => {
    const test = await oidcTestApp({ publicUrl: 'http://localhost:5173' })
    const login = await send(test.app, '/auth/login')
    const txLine = setCookieLine(login, 'sieb_login')
    const authorizeUrl = new URL(login.headers.get('location') ?? '')
    const response = await send(test.app, await authorize(test.idp, authorizeUrl), {
      headers: { Cookie: `sieb_login=${setCookies(login).sieb_login}` },
    })
    const line = setCookieLine(response, 'sieb_session')

    expect(txLine).toMatch(
      /^sieb_login=[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/,
    )
    expect(txLine).toContain('Path=/;')
    expect(txLine).not.toContain('Secure')

    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/auth/callback',
    )
    expect(response.status).toBe(302)
    expect(line).toMatch(/^sieb_session=[A-Za-z0-9_-]{43};/)
    expect(line).toContain('HttpOnly')
    expect(line).not.toContain('Secure')
  })

  it('refuses a forged state', async () => {
    const test = await oidcTestApp()
    const { txId, authorizeUrl } = await startLogin(test.app)
    const path = (await authorize(test.idp, authorizeUrl)).replace(/state=[^&]+/, 'state=forged')
    const response = await callback(test, path, txId)

    expect(response.status).toBe(400)
    expect(await response.text()).toContain('Try again')
    expect(sessionCount(test)).toBe(0)
    expect(test.logs.some((line) => line.startsWith('[sieb] login failed: code exchange'))).toBe(
      true,
    )
  })

  it('refuses an ID token with another nonce', async () => {
    const test = await oidcTestApp()
    const { txId, authorizeUrl } = await startLogin(test.app)

    test.idp.nonceOverride = 'replayed-nonce'
    const response = await callback(test, await authorize(test.idp, authorizeUrl), txId)

    expect(response.status).toBe(400)
    expect(sessionCount(test)).toBe(0)
    expect(test.logs.join('\n')).toMatch(/nonce/)
  })

  it('refuses an ID token signed by a key outside the issuer key set', async () => {
    const test = await oidcTestApp()

    test.idp.foreignKey = true
    const { callback: response } = await logIn(test)

    expect(response.status).toBe(400)
    expect(sessionCount(test)).toBe(0)
    expect(test.logs.join('\n')).toMatch(/signature/i)
  })

  it('refuses a code injected from another login, which fails PKCE at the issuer', async () => {
    const test = await oidcTestApp()
    const victim = await startLogin(test.app)
    const attacker = await startLogin(test.app)
    const attackerCode = new URL(
      await authorize(test.idp, attacker.authorizeUrl),
      'https://sieb.example',
    ).searchParams.get('code')
    const state = victim.authorizeUrl.searchParams.get('state') ?? ''
    const response = await callback(
      test,
      `/auth/callback?code=${attackerCode}&state=${encodeURIComponent(state)}`,
      victim.txId,
    )

    expect(response.status).toBe(400)
    expect(sessionCount(test)).toBe(0)
  })

  it('refuses forged, tampered, missing, foreign and expired logins and replayed codes', async () => {
    const test = await oidcTestApp()
    const other = await oidcTestApp()
    const first = await startLogin(test.app)
    const path = await authorize(test.idp, first.authorizeUrl)
    const done = await callback(test, path, first.txId)
    const replay = await callback(test, path, first.txId)
    const forged = await callback(test, path, 'A'.repeat(43))
    const tampered = await callback(test, path, `${first.txId.slice(0, -2)}AA`)
    const missing = await send(test.app, path)
    const foreign = await startLogin(other.app)
    const foreignPath = await authorize(other.idp, foreign.authorizeUrl)
    const fromOtherProcess = await callback(test, foreignPath, foreign.txId)
    const late = await startLogin(test.app)
    const latePath = await authorize(test.idp, late.authorizeUrl)

    test.now.ms += 10 * 60 * 1000
    const expired = await callback(test, latePath, late.txId)

    expect(done.status).toBe(302)
    expect(setCookieLine(done, '__Host-sieb_login')).toContain('Max-Age=0')
    expect(
      [replay, forged, tampered, missing, fromOtherProcess, expired].map((r) => r.status),
    ).toEqual([400, 400, 400, 400, 400, 400])
    expect(sessionCount(test)).toBe(1)
    expect(test.logs.filter((line) => line.includes('unknown or expired login'))).toHaveLength(5)
    expect(test.logs.filter((line) => line.includes('login cookie used twice'))).toHaveLength(1)
  })

  it('refuses a second callback with the same login cookie and a fresh code', async () => {
    const test = await oidcTestApp()
    const { txId, authorizeUrl } = await startLogin(test.app)
    const first = await callback(test, await authorize(test.idp, authorizeUrl), txId)
    const second = await callback(test, await authorize(test.idp, authorizeUrl), txId)

    expect(first.status).toBe(302)
    expect(second.status).toBe(400)
    expect(setCookies(second)['__Host-sieb_session']).toBeUndefined()
    expect(sessionCount(test)).toBe(1)
    expect(test.logs).toContain('[sieb] login failed: login cookie used twice')
  })

  it('refuses an error answer of the issuer without reflecting it and spends the login', async () => {
    const test = await oidcTestApp()
    const { txId, authorizeUrl } = await startLogin(test.app)
    const state = authorizeUrl.searchParams.get('state') ?? ''
    const response = await callback(
      test,
      `/auth/callback?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E%0Aforged&state=${state}`,
      txId,
    )
    const page = await response.text()

    expect(response.status).toBe(400)
    expect(page).not.toContain('<script>')
    expect(page).not.toContain('alert')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(test.logs).toContain(
      '[sieb] login failed: identity provider answered <script>alert(1)</script> forged',
    )
    expect(setCookieLine(response, '__Host-sieb_login')).toContain('Max-Age=0')
  })

  it('refuses an ID token without preferred_username', async () => {
    const test = await oidcTestApp()

    test.idp.claims = { groups: ['sieb-users'], preferred_username: undefined }
    const { callback: response } = await logIn(test)

    expect(response.status).toBe(400)
    expect(sessionCount(test)).toBe(0)
    expect(test.logs).toContain('[sieb] login failed: ID token without a usable preferred_username')

    test.idp.claims = { groups: ['sieb-users'], preferred_username: 'ali\u202ece' }
    expect((await logIn(test)).callback.status).toBe(400)
    expect(sessionCount(test)).toBe(0)
  })

  it('answers 403 when the required group is missing, ending sessions and tokens, and admits everyone without one', async () => {
    const test = await oidcTestApp({ mcpEnabled: true })

    insertToken(
      test.deps.db,
      {
        owner: 'mallory',
        input: { name: 'laptop', scope: 'read', expiresAt: '2026-07-01T00:00:00.000Z' },
        prefix: 'sieb_abcd',
        hash: 'a'.repeat(64),
      },
      new Date(test.now.ms),
    )
    test.idp.claims = { preferred_username: 'mallory', groups: ['sieb-users'] }
    const { session: before } = await logIn(test)
    const tokensBefore = await send(test.app, '/api/tokens', { headers: sessionHeaders(before) })
    test.idp.claims = { preferred_username: 'mallory', groups: ['other'] }
    const { callback: refused } = await logIn(test)
    const tokensAfter = await send(test.app, '/api/tokens', { headers: sessionHeaders(before) })
    const open = await oidcTestApp({ oidc: { ...test.deps.oidc!, requiredGroup: null } })

    open.idp.claims = { preferred_username: 'bob' }
    const { callback: admitted } = await logIn(open)

    expect(refused.status).toBe(403)
    expect(await refused.text()).toContain('not allowed')
    expect(sessionCount(test)).toBe(0)
    expect(test.logs).toContain('[sieb] login failed: mallory is not in the required group')
    expect(tokensBefore.status).toBe(200)
    expect(tokensAfter.status).toBe(401)
    expect(setCookieLine(refused, '__Host-sieb_session')).toContain('Max-Age=0')
    expect(test.logs).toContain(
      '[sieb] ended 1 sessions and revoked 1 api tokens of mallory, not in the required group',
    )
    expect(listOwnTokens(test.deps.db, 'mallory')[0]).toMatchObject({ revokedBy: 'sieb' })
    expect(admitted.status).toBe(302)
  })

  it('replaces the previous session of the browser', async () => {
    const test = await oidcTestApp()
    const { session: first } = await logIn(test)
    const { txId, authorizeUrl } = await startLogin(test.app)
    const second = await send(test.app, await authorize(test.idp, authorizeUrl), {
      headers: { Cookie: `__Host-sieb_login=${txId}; __Host-sieb_session=${first}` },
    })

    expect(second.status).toBe(302)
    expect(setCookies(second)['__Host-sieb_session']).not.toBe(first)
    expect(sessionCount(test)).toBe(1)
    expect((await send(test.app, '/api/me', { headers: sessionHeaders(first) })).status).toBe(401)
  })
})

describe('return path', () => {
  it.each([
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    ['%2F%2Fevil.example', '/'],
    ['%2F%5Cevil.example', '/'],
    ['%252F%252Fevil.example', '/'],
    ['%2F%09%2Fevil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['/auth/logout', '/'],
    ['/inbox%3Fa%3D1', '/inbox?a=1'],
  ])('sends return=%s to %s after the login', async (value, expected) => {
    const test = await oidcTestApp()
    const { callback: response } = await logIn(test, `?return=${value}`)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(expected)
  })
})
