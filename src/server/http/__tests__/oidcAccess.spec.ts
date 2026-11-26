// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import type { ApiTokenCreateResponse, MeResponse } from '#core/apiTypes.ts'
import {
  logIn,
  oidcTestApp,
  send,
  sessionHeaders,
  type OidcTestApp,
} from '#server/auth/oidc/__tests__/oidcTestApp.ts'
import { PUBLIC_STATIC_FILES, sessionAccessOf } from '#server/http/sessionAccess.ts'

const staticDir = mkdtempSync(join(tmpdir(), 'sieb-oidc-dist-'))

mkdirSync(join(staticDir, 'assets'))
writeFileSync(join(staticDir, 'index.html'), '<div id="app"></div>')
writeFileSync(join(staticDir, 'assets', 'index-abc.js'), 'export {}')
writeFileSync(join(staticDir, 'favicon.ico'), 'icon')
writeFileSync(join(staticDir, 'site.webmanifest'), '{}')

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true })
})

const INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 't', version: '1' },
  },
})

/**
 * Creates an oidc app serving the test client build with MCP enabled.
 * @returns {Promise<OidcTestApp>} - Test app
 */
const fullApp = (): Promise<OidcTestApp> => oidcTestApp({ staticDir, mcpEnabled: true })

/**
 * Posts an MCP initialize request.
 * @param {OidcTestApp} test - Test app
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<Response>} - Response
 */
const mcpInitialize = (test: OidcTestApp, headers: Record<string, string>): Promise<Response> =>
  send(test.app, '/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: INITIALIZE,
  })

describe('oidc access without a session', () => {
  it('answers /api with 401 for reads and writes, ignoring the forward-auth header', async () => {
    const test = await fullApp()
    const header = { 'X-authentik-username': 'alice' }
    const read = await send(test.app, '/api/findings', { headers: header })
    const me = await send(test.app, '/api/me', { headers: header })
    const write = await send(test.app, '/api/sync', {
      method: 'POST',
      headers: { ...header, 'Content-Type': 'application/json' },
    })

    expect([read.status, me.status, write.status]).toEqual([401, 401, 401])
    expect(await read.json()).toEqual({ error: 'unauthorized' })
  })

  it('redirects page navigations to the sign-in page with path and query as return target', async () => {
    const test = await fullApp()
    const root = await send(test.app, '/')
    const deep = await send(test.app, '/inbox?finding=3&view=all')
    const head = await send(test.app, '/inbox', { method: 'HEAD' })

    expect(root.status).toBe(302)
    expect(root.headers.get('location')).toBe('/auth/signin?return=%2F')
    expect(root.headers.get('Cache-Control')).toBe('no-store')
    expect(deep.headers.get('location')).toBe(
      `/auth/signin?return=${encodeURIComponent('/inbox?finding=3&view=all')}`,
    )
    expect(head.headers.get('location')).toBe('/auth/signin?return=%2Finbox')
  })

  it('serves the sign-in page itself without a session', async () => {
    const test = await fullApp()
    const page = await send(test.app, '/auth/signin?return=%2F')

    expect(page.status).toBe(200)
    expect(await page.text()).toContain('href="/auth/login?return=%2F"')
  })

  it('answers assets 401 and serves the icons and the manifest', async () => {
    const test = await fullApp()
    const asset = await send(test.app, '/assets/index-abc.js')
    const index = await send(test.app, '/index.html')
    const favicon = await send(test.app, '/favicon.ico')
    const manifest = await send(test.app, '/site.webmanifest')

    expect([asset.status, index.status]).toEqual([401, 401])
    expect(await asset.text()).not.toContain('export')
    expect([favicon.status, manifest.status]).toEqual([200, 200])
  })

  it('keeps the health check open and /metrics a plain 404', async () => {
    const test = await fullApp()
    const metrics = await send(test.app, '/metrics')

    expect((await send(test.app, '/api/health')).status).toBe(200)
    expect(metrics.status).toBe(404)
    expect(await metrics.json()).toEqual({ error: 'not_found' })
  })

  it('leaves /mcp bearer-only: 401 with a challenge, never a login redirect', async () => {
    const test = await fullApp()
    const response = await mcpInitialize(test, { 'X-authentik-username': 'alice' })

    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toMatch(/^Bearer/)
  })

  it('answers 401 for a cookie of an expired session and deletes it', async () => {
    const test = await fullApp()
    const { session } = await logIn(test)

    test.now.ms += 12 * 60 * 60 * 1000
    const response = await send(test.app, '/api/findings', { headers: sessionHeaders(session) })

    expect(response.status).toBe(401)
    expect(test.deps.db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n).toBe(0)
  })
})

describe('oidc access with a session', () => {
  it('serves /api, pages and assets and acts as the session user, not the header', async () => {
    const test = await fullApp()
    const { session } = await logIn(test)
    const cookie = sessionHeaders(session)
    const findings = await send(test.app, '/api/findings', { headers: cookie })
    const me = await send(test.app, '/api/me', {
      headers: { ...cookie, 'X-authentik-username': 'mallory' },
    })

    expect(findings.status).toBe(200)
    expect(await me.json()).toEqual<MeResponse>({
      username: 'alice',
      authMode: 'oidc',
      version: '0.0.0',
      sourceCodeUrl: 'https://github.com/bernhardkelm/sieb/tree/0.0.0',
    })
    expect((await send(test.app, '/inbox', { headers: cookie })).status).toBe(200)
    expect((await send(test.app, '/assets/index-abc.js', { headers: cookie })).status).toBe(200)
    expect((await send(test.app, '/metrics', { headers: cookie })).status).toBe(404)
  })

  it('lets the session user create a personal token that works on /mcp, the cookie alone does not', async () => {
    const test = await fullApp()

    test.now.ms = Date.now()
    const { session } = await logIn(test)
    const cookie = sessionHeaders(session)
    const created = await send(test.app, '/api/tokens', {
      method: 'POST',
      headers: { ...cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'laptop',
        scope: 'read',
        expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }),
    })
    const { secret, token } = (await created.json()) as ApiTokenCreateResponse
    const viaCookie = await mcpInitialize(test, cookie)
    const viaToken = await mcpInitialize(test, { Authorization: `Bearer ${secret}` })
    const bearerOnApi = await send(test.app, '/api/findings', {
      headers: { Authorization: `Bearer ${secret}` },
    })

    expect(created.status).toBe(201)
    expect(token.prefix).toMatch(/^sieb_/)
    expect(viaCookie.status).toBe(401)
    expect(viaToken.status).toBe(200)
    expect(bearerOnApi.status).toBe(401)
  })
})

describe('sessionAccessOf', () => {
  it('classifies paths for requests without a session', () => {
    expect(sessionAccessOf('GET', '/auth/login', false)).toBe('public')
    expect(sessionAccessOf('GET', '/auth/signin', false)).toBe('public')
    expect(sessionAccessOf('GET', '/authx', false)).toBe('page')
    expect(sessionAccessOf('GET', '/api/health', false)).toBe('public')
    expect(sessionAccessOf('GET', '/api/health/x', false)).toBe('api')
    expect(sessionAccessOf('GET', '/api', false)).toBe('api')
    expect(sessionAccessOf('POST', '/mcp', true)).toBe('public')
    expect(sessionAccessOf('POST', '/mcp', false)).toBe('other')
    expect(sessionAccessOf('GET', '/.well-known/oauth-protected-resource/mcp', true)).toBe('public')
    expect(sessionAccessOf('GET', '/.well-known/oauth-protected-resource', false)).toBe('other')
    expect(sessionAccessOf('GET', '/.well-known/openid-configuration', true)).toBe('other')
    expect(sessionAccessOf('POST', '/inbox', false)).toBe('other')
    expect(sessionAccessOf('HEAD', '/inbox', false)).toBe('page')
    expect(PUBLIC_STATIC_FILES.map((path) => sessionAccessOf('GET', path, false))).toEqual(
      PUBLIC_STATIC_FILES.map(() => 'public'),
    )
  })
})
