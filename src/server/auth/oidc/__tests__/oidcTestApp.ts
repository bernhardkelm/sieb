import type { Hono } from 'hono'

import type { AppEnv } from '#server/http/AppEnv.ts'
import { testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'
import type { OidcConfig } from '#server/oidcConfigValues.ts'

import {
  createFakeOidcProvider,
  IDP_CLIENT_ID,
  IDP_CLIENT_SECRET,
  IDP_ISSUER,
  type FakeOidcProvider,
} from './fakeOidcProvider.ts'

export const PUBLIC_URL = 'https://sieb.example'

export const OIDC: OidcConfig = {
  issuer: IDP_ISSUER,
  clientId: IDP_CLIENT_ID,
  clientSecret: IDP_CLIENT_SECRET,
  requiredGroup: 'sieb-users',
  sessionHours: 12,
  displayName: 'SSO',
}

export interface OidcTestApp {
  app: Hono<AppEnv>
  deps: AppDeps
  idp: FakeOidcProvider
  logs: string[]
  now: { ms: number } // mutable app clock
}

/**
 * Creates an oidc-mode app over the base mock fixtures, a fake provider and a movable clock.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {Promise<OidcTestApp>} - App, dependencies, provider, log lines, clock
 */
export const oidcTestApp = async (overrides: Partial<AppDeps> = {}): Promise<OidcTestApp> => {
  const idp = createFakeOidcProvider()
  const logs: string[] = []
  const now = { ms: new Date('2026-06-01T12:00:00.000Z').getTime() }
  const deps = testAppDeps({
    clock: () => new Date(now.ms),
    authMode: 'oidc',
    oidc: OIDC,
    oidcFetch: idp.fetch,
    publicUrl: PUBLIC_URL,
    allowedHosts: ['sieb.example'],
    devUser: null,
    log: (message) => {
      logs.push(message)
    },
    ...overrides,
  })

  await deps.sync.syncNow()
  return { app: createApp(deps), deps, idp, logs, now }
}

/**
 * Collects name=value pairs of the Set-Cookie headers of a response.
 * @param {Response} response - Response
 * @returns {Record<string, string>} - Cookie values by name, empty values for cleared cookies
 */
export const setCookies = (response: Response): Record<string, string> =>
  Object.fromEntries(
    response.headers.getSetCookie().map((line) => {
      const [pair = ''] = line.split(';')
      const index = pair.indexOf('=')
      return [pair.slice(0, index), pair.slice(index + 1)]
    }),
  )

/**
 * Finds the full Set-Cookie line of a cookie.
 * @param {Response} response - Response
 * @param {string} name - Cookie name
 * @returns {string} - Header line, empty when missing
 */
export const setCookieLine = (response: Response, name: string): string =>
  response.headers.getSetCookie().find((line) => line.startsWith(`${name}=`)) ?? ''

/**
 * Sends a request to the app as the public host.
 * @param {Hono<AppEnv>} app - App
 * @param {string} path - Path and query
 * @param {RequestInit} init - Request options
 * @returns {Promise<Response>} - Response
 */
export const send = async (
  app: Hono<AppEnv>,
  path: string,
  init: RequestInit = {},
): Promise<Response> => app.request(`${PUBLIC_URL}${path}`, init)

/** A started login: the login cookie and the URL the browser would be sent to */
export interface StartedLogin {
  txId: string
  authorizeUrl: URL
}

/**
 * Starts a login through GET /auth/login.
 * @param {Hono<AppEnv>} app - App
 * @param {string} query - Query string of the login request
 * @returns {Promise<StartedLogin>} - Login cookie value and authorize URL
 */
export const startLogin = async (app: Hono<AppEnv>, query = ''): Promise<StartedLogin> => {
  const response = await send(app, `/auth/login${query}`)

  return {
    txId: setCookies(response)['__Host-sieb_login'] ?? setCookies(response).sieb_login ?? '',
    authorizeUrl: new URL(response.headers.get('location') ?? ''),
  }
}

/**
 * Lets the fake provider answer an authorize URL and returns the callback path it redirects to.
 * @param {FakeOidcProvider} idp - Provider
 * @param {URL} authorizeUrl - Authorize URL from the login
 * @returns {Promise<string>} - Callback path and query on sieb
 */
export const authorize = async (idp: FakeOidcProvider, authorizeUrl: URL): Promise<string> => {
  const response = await idp.fetch(authorizeUrl.href, {
    method: 'GET',
    headers: {},
    body: undefined,
    redirect: 'manual',
  })
  const location = new URL(response.headers.get('location') ?? '')

  return `${location.pathname}${location.search}`
}

/**
 * Runs the whole login of the fake provider's current user.
 * @param {OidcTestApp} test - Test app
 * @param {string} query - Query string of the login request
 * @returns {Promise<{ callback: Response; session: string }>} - Callback response and session cookie value
 */
export const logIn = async (
  { app, idp }: OidcTestApp,
  query = '',
): Promise<{ callback: Response; session: string }> => {
  const { txId, authorizeUrl } = await startLogin(app, query)
  const callback = await send(app, await authorize(idp, authorizeUrl), {
    headers: { Cookie: `__Host-sieb_login=${txId}` },
  })

  return { callback, session: setCookies(callback)['__Host-sieb_session'] ?? '' }
}

/**
 * Builds the Cookie header of a session.
 * @param {string} session - Session cookie value
 * @returns {Record<string, string>} - Headers
 */
export const sessionHeaders = (session: string): Record<string, string> => ({
  Cookie: `__Host-sieb_session=${session}`,
})
