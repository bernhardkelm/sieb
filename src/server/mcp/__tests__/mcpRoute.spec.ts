// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose'

import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import type { ApiTokenCreateResponse } from '#core/tokenApiTypes.ts'
import { testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'
import { isClientRoute } from '#server/http/spaRoutes.ts'
import { createRateLimiter, MCP_RATE_LIMIT } from '#server/mcp/mcpGuards.ts'
import type { OAuthConfig } from '#server/mcpConfigValues.ts'

const PUBLIC_URL = 'https://sieb.example.com'
const ISSUER = 'https://auth.example.com/application/o/sieb-mcp/'
const OAUTH: OAuthConfig = {
  issuer: ISSUER,
  clientId: 'sieb-mcp',
  jwksUrl: null,
  requiredGroup: null,
  clientLabel: 'claude.ai',
}
const METADATA_URL = `${PUBLIC_URL}/.well-known/oauth-protected-resource/mcp`
const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
}
const TOOLS_LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
const ALL_SCOPES = 'scope="sieb:read sieb:propose"'

const rsa = await generateKeyPair('RS256')
const jwtKeys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(rsa.publicKey)), kid: 'k1', alg: 'RS256' }],
})

type App = ReturnType<typeof createApp>

/**
 * Creates an app with MCP enabled and no dev user on the real clock, since the MCP SDK checks
 * token expiry against the wall clock.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {App} - App
 */
const mcpApp = (overrides: Partial<AppDeps> = {}): App =>
  createApp(
    testAppDeps({
      devUser: null,
      mcpEnabled: true,
      jwtKeys,
      clock: () => new Date(),
      ...overrides,
    }),
  )

/**
 * Creates a personal token of alice through the API.
 * @param {App} app - App
 * @returns {Promise<string>} - Secret
 */
const aliceSecret = async (app: App): Promise<string> => {
  const response = await app.request('/api/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-authentik-username': 'alice' },
    body: JSON.stringify({
      name: 'laptop',
      scope: 'read',
      expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }),
  })

  return ((await response.json()) as ApiTokenCreateResponse).secret
}

/**
 * Posts a JSON-RPC message to /mcp.
 * @param {App} app - App
 * @param {unknown} message - JSON-RPC message, a string is sent as is
 * @param {Record<string, string>} headers - Extra headers
 * @returns {Promise<Response>} - Response
 */
const post = async (
  app: App,
  message: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  app.request('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: typeof message === 'string' ? message : JSON.stringify(message),
  })

/**
 * Signs an OAuth access token valid for five minutes of real time.
 * @param {JWTPayload} claims - Claim overrides
 * @returns {Promise<string>} - Compact JWT
 */
const accessToken = (claims: JWTPayload = {}): Promise<string> =>
  new SignJWT({
    iss: ISSUER,
    aud: 'sieb-mcp',
    exp: Math.floor(Date.now() / 1000) + 300,
    preferred_username: 'alice',
    scope: 'openid sieb:read',
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .sign(rsa.privateKey)

describe('/mcp authentication', () => {
  it('answers 401 with a Bearer challenge naming every scope, with the metadata URL under OAuth', async () => {
    const plain = await post(mcpApp(), INITIALIZE)
    const oauth = await post(mcpApp({ publicUrl: PUBLIC_URL, oauth: OAUTH }), INITIALIZE)

    expect(plain.status).toBe(401)
    expect(plain.headers.get('WWW-Authenticate')).toMatch(/^Bearer error="invalid_token"/)
    expect(plain.headers.get('WWW-Authenticate')).toContain(ALL_SCOPES)
    expect(oauth.status).toBe(401)
    expect(oauth.headers.get('WWW-Authenticate')).toContain(ALL_SCOPES)
    expect(oauth.headers.get('WWW-Authenticate')).toContain(`resource_metadata="${METADATA_URL}"`)
  })

  it('challenges an invalid OAuth token with every scope', async () => {
    const app = mcpApp({ publicUrl: PUBLIC_URL, oauth: OAUTH })
    const expired = await post(app, INITIALIZE, {
      Authorization: `Bearer ${await accessToken({ exp: Math.floor(Date.now() / 1000) - 3600 })}`,
    })
    const challenge = expired.headers.get('WWW-Authenticate')

    expect(expired.status).toBe(401)
    expect(challenge).toMatch(/^Bearer error="invalid_token"/)
    expect(challenge).toContain(ALL_SCOPES)
    expect(challenge).toContain(`resource_metadata="${METADATA_URL}"`)
  })

  it('ignores the forward-auth header and unknown tokens', async () => {
    const app = mcpApp()
    const header = await post(app, INITIALIZE, { 'X-authentik-username': 'alice' })
    const unknown = await post(app, INITIALIZE, { Authorization: `Bearer sieb_${'x'.repeat(43)}` })
    const garbage = await post(app, INITIALIZE, { Authorization: 'Bearer nonsense' })

    expect([header.status, unknown.status, garbage.status]).toEqual([401, 401, 401])
    expect(unknown.headers.get('WWW-Authenticate')).toContain(ALL_SCOPES)
    expect(garbage.headers.get('WWW-Authenticate')).toContain(ALL_SCOPES)
  })

  it('lets a personal token initialize and list the tools', async () => {
    const app = mcpApp({ publicUrl: PUBLIC_URL, version: '9.8.7' })
    const auth = { Authorization: `Bearer ${await aliceSecret(app)}` }
    const initialize = await post(app, INITIALIZE, auth)
    const tools = await post(app, TOOLS_LIST, auth)
    const result = (await initialize.json()) as {
      result: { serverInfo: { name: string; version: string }; instructions?: string }
    }
    const listed = (await tools.json()) as { result: { tools: { name: string }[] } }

    expect(initialize.status).toBe(200)
    expect(initialize.headers.get('Content-Type')).toMatch(/^application\/json/)
    expect(result.result.serverInfo).toMatchObject({ name: 'sieb', version: '9.8.7' })
    expect(result.result.instructions).toEqual(expect.any(String))
    expect(tools.status).toBe(200)
    expect(listed.result.tools.map((tool) => tool.name)).toContain('search_findings')
  })

  it('refuses a revoked token', async () => {
    const app = mcpApp()
    const secret = await aliceSecret(app)

    await app.request('/api/tokens/1/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-authentik-username': 'alice' },
    })

    expect((await post(app, INITIALIZE, { Authorization: `Bearer ${secret}` })).status).toBe(401)
  })

  it('accepts an OAuth access token with sieb:read and refuses one without', async () => {
    const app = mcpApp({ publicUrl: PUBLIC_URL, oauth: OAUTH })
    const auth = { Authorization: `Bearer ${await accessToken()}` }
    const valid = await post(app, INITIALIZE, auth)
    const tools = (await (await post(app, TOOLS_LIST, auth)).json()) as {
      result: { tools: { name: string }[] }
    }
    const noScope = await post(app, INITIALIZE, {
      Authorization: `Bearer ${await accessToken({ scope: 'openid' })}`,
    })

    expect(valid.status).toBe(200)
    expect(tools.result.tools.map((tool) => tool.name)).toContain('search_findings')
    expect(tools.result.tools.map((tool) => tool.name)).not.toContain('propose_decision')
    expect(noScope.status).toBe(403)
    expect(noScope.headers.get('WWW-Authenticate')).toMatch(
      /^Bearer error="insufficient_scope", .*, scope="sieb:read", resource_metadata=/,
    )
  })

  it('logs each initialize with actor, via and scopes, never the token', async () => {
    const lines: string[] = []
    const app = mcpApp({ publicUrl: PUBLIC_URL, oauth: OAUTH, log: (line) => lines.push(line) })
    const token = await accessToken({ scope: 'openid sieb:read sieb:propose' })
    const auth = { Authorization: `Bearer ${token}` }

    expect((await post(app, INITIALIZE, auth)).status).toBe(200)
    expect((await post(app, TOOLS_LIST, auth)).status).toBe(200)

    const handshakes = lines.filter((line) => line.includes('MCP initialize'))

    expect(handshakes).toEqual([
      '[sieb] MCP initialize by alice via oauth (claude.ai) from test, scopes sieb:read sieb:propose',
    ])
    expect(lines.join('\n')).not.toContain(token)
  })

  it('points Claude Code at the repository of own images in the instructions', async () => {
    const app = mcpApp({ publicUrl: PUBLIC_URL })
    const auth = { Authorization: `Bearer ${await aliceSecret(app)}` }
    const instructionsOf = async (name: string): Promise<string> => {
      const body = {
        ...INITIALIZE,
        params: { ...INITIALIZE.params, clientInfo: { name, version: '1' } },
      }
      const result = (await (await post(app, body, auth)).json()) as {
        result: { instructions: string }
      }

      return result.result.instructions
    }

    expect(await instructionsOf('claude-code')).toContain(
      'its repository is probably on this machine: if the working directory is not it',
    )
    expect(await instructionsOf('claude-ai')).not.toContain('working directory')
  })

  it('never takes a bearer token as identity on /api', async () => {
    const app = mcpApp()
    const auth = {
      Authorization: `Bearer ${await aliceSecret(app)}`,
      'Content-Type': 'application/json',
    }
    const me = await app.request('/api/me', { headers: auth })
    const write = await app.request('/api/decisions', { method: 'POST', headers: auth, body: '{}' })

    expect(await me.json()).toMatchObject({ username: null, authMode: 'header' })
    expect(write.status).toBe(401)
  })

  it('records an OAuth caller, so /api/mcp-info reports that user connected without a token', async () => {
    const app = mcpApp({ publicUrl: PUBLIC_URL, oauth: OAUTH })
    const claudeOf = async (user: string): Promise<unknown> =>
      (
        (await (
          await app.request('/api/mcp-info', { headers: { 'X-authentik-username': user } })
        ).json()) as McpInfoResponse
      ).claude

    expect(await claudeOf('alice')).toMatchObject({ connected: false, oauthLastSeenAt: null })
    expect(
      (await post(app, TOOLS_LIST, { Authorization: `Bearer ${await accessToken()}` })).status,
    ).toBe(200)
    expect(await claudeOf('alice')).toMatchObject({
      connected: true,
      activeTokens: 0,
      oauthLastSeenAt: expect.any(String),
    })
    expect(await claudeOf('bob')).toMatchObject({ connected: false, oauthLastSeenAt: null })
  })
})

describe('/mcp request guards', () => {
  it('answers 403 for a foreign Origin and lets same-host and allowlisted origins through', async () => {
    const app = mcpApp({ mcpAllowedOrigins: ['https://claude.ai'] })
    const foreign = await post(app, INITIALIZE, { Origin: 'https://evil.example' })
    const nullOrigin = await post(app, INITIALIZE, { Origin: 'null' })
    const sameHost = await post(app, INITIALIZE, { Origin: 'http://localhost' })
    const allowed = await post(app, INITIALIZE, { Origin: 'https://claude.ai' })

    expect(foreign.status).toBe(403)
    expect(await foreign.json()).toEqual({ error: 'forbidden_origin' })
    expect(nullOrigin.status).toBe(403)
    expect([sameHost.status, allowed.status]).toEqual([401, 401])
  })

  it('answers 413 for bodies over 128 KiB and 403 for a foreign Host', async () => {
    const app = mcpApp()
    const large = await post(app, JSON.stringify({ ...INITIALIZE, pad: 'x'.repeat(130 * 1024) }))
    const host = await post(app, INITIALIZE, { Host: 'evil.example' })

    expect(large.status).toBe(413)
    expect(await large.json()).toEqual({ error: 'payload_too_large' })
    expect(host.status).toBe(403)
    expect(await host.json()).toEqual({ error: 'forbidden_host' })
  })

  it('limits each caller to MCP_RATE_LIMIT requests per minute', async () => {
    const app = mcpApp()
    const auth = { Authorization: `Bearer ${await aliceSecret(app)}` }
    const ping = { jsonrpc: '2.0', id: 3, method: 'ping', params: {} }
    const statuses: number[] = []

    for (let index = 0; index <= MCP_RATE_LIMIT; index += 1) {
      statuses.push((await post(app, ping, auth)).status)
    }

    expect(statuses.slice(0, MCP_RATE_LIMIT).every((status) => status === 200)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })

  it('resets the window of a caller after a minute', () => {
    const limiter = createRateLimiter(2, 60_000)

    expect([limiter.hit('a', 0), limiter.hit('a', 1), limiter.hit('a', 30_000)]).toEqual([
      null,
      null,
      30,
    ])
    expect(limiter.hit('b', 30_000)).toBeNull()
    expect(limiter.hit('a', 60_000)).toBeNull()
  })
})

describe('protected resource metadata and the MCP switch', () => {
  it('serves the metadata at both well-known paths only under OAuth', async () => {
    const app = mcpApp({ publicUrl: PUBLIC_URL, oauth: OAUTH })
    const expected = {
      resource: `${PUBLIC_URL}/mcp`,
      authorization_servers: [ISSUER],
      scopes_supported: ['sieb:read', 'sieb:propose'],
      bearer_methods_supported: ['header'],
      resource_name: 'sieb',
    }

    for (const path of ['/oauth-protected-resource', '/oauth-protected-resource/mcp']) {
      const response = await app.request(`/.well-known${path}`)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }

    expect((await mcpApp().request('/.well-known/oauth-protected-resource')).status).toBe(404)
  })

  it('mounts neither /mcp nor the metadata while MCP is off', async () => {
    const app = mcpApp({ mcpEnabled: false, publicUrl: PUBLIC_URL, oauth: OAUTH })
    const mcp = await post(app, INITIALIZE, { Authorization: 'Bearer sieb_x' })
    const metadata = await app.request('/.well-known/oauth-protected-resource/mcp')

    expect(mcp.status).toBe(404)
    expect(await mcp.json()).toEqual({ error: 'not_found' })
    expect(metadata.status).toBe(404)
    expect(await metadata.json()).toEqual({ error: 'not_found' })
  })

  it('keeps /mcp and /.well-known out of the client routes', () => {
    expect(isClientRoute('/mcp')).toBe(false)
    expect(isClientRoute('/.well-known/oauth-protected-resource/mcp')).toBe(false)
    expect(isClientRoute('/.well-known')).toBe(false)
    expect(isClientRoute('/mcpx')).toBe(true)
  })
})
