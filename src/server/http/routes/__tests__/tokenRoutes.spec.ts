// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { MAX_LIVE_TOKENS } from '#core/apiToken.ts'
import type { ApiTokenCreateResponse, ApiTokenView, McpInfoResponse } from '#core/apiTypes.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'

import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'

const ALICE = { 'X-authentik-username': 'alice' }
const BOB = { 'X-authentik-username': 'bob' }

/**
 * Creates an app without a dev user, MCP enabled unless overridden, and collects its log.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {{ app: ReturnType<typeof createApp>; logs: string[]; deps: AppDeps }} - App, log lines and dependencies
 */
const tokenApp = (
  overrides: Partial<AppDeps> = {},
): { app: ReturnType<typeof createApp>; logs: string[]; deps: AppDeps } => {
  const logs: string[] = []
  const deps = testAppDeps({
    devUser: null,
    mcpEnabled: true,
    log: (line) => logs.push(line),
    ...overrides,
  })

  return { app: createApp(deps), logs, deps }
}

/**
 * Creates a token through the API.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {Record<string, string>} user - Identity header
 * @param {unknown} body - Request body
 * @returns {Promise<{ status: number; body: ApiTokenCreateResponse }>} - Answer
 */
const create = (
  app: ReturnType<typeof createApp>,
  user: Record<string, string>,
  body: unknown = { name: 'laptop', scope: 'read', expiresAt: '2026-07-01' },
): Promise<{ status: number; body: ApiTokenCreateResponse }> =>
  requestJson<ApiTokenCreateResponse>(app, '/api/tokens', 'POST', body, user)

describe('token routes', () => {
  it('creates a token, answers its secret once with no-store and logs without the secret', async () => {
    const { app, logs } = tokenApp()
    const response = await app.request('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ALICE },
      body: JSON.stringify({ name: 'laptop', scope: 'read', expiresAt: '2026-08-30' }),
    })
    const created = (await response.json()) as ApiTokenCreateResponse

    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(created.secret).toMatch(/^sieb_[A-Za-z0-9_-]{43}$/)
    expect(created.token).toEqual({
      id: 1,
      name: 'laptop',
      scope: 'read',
      prefix: created.secret.slice(0, 13),
      createdAt: '2026-06-01T12:00:00.000Z',
      expiresAt: '2026-08-30T23:59:59.999Z',
      lastUsedAt: null,
      revokedAt: null,
    })
    expect(logs).toEqual(['[sieb] api token created: owner="alice" name="laptop" id=1 scope=read'])
    expect(logs.join('')).not.toContain(created.secret)
    expect(
      JSON.stringify((await requestJson(app, '/api/tokens', 'GET', undefined, ALICE)).body),
    ).not.toContain(created.secret)
  })

  it('answers validation errors in the shared shape', async () => {
    const { app } = tokenApp()

    expect(await create(app, ALICE, { name: '', scope: 'admin', expiresAt: null })).toEqual({
      status: 400,
      body: {
        error: 'validation',
        errors: [
          { field: 'name', code: 'required' },
          { field: 'scope', code: 'invalid' },
          { field: 'expiresAt', code: 'required' },
        ],
      },
    })
    expect(await create(app, ALICE, { name: 'x', scope: 'read', expiresAt: '2027-06-03' })).toEqual(
      {
        status: 400,
        body: { error: 'validation', errors: [{ field: 'expiresAt', code: 'too_far' }] },
      },
    )
    expect(
      (await create(app, ALICE, { name: 'x', scope: 'propose', expiresAt: '2027-06-01' })).status,
    ).toBe(201)
  })

  it('keeps tokens per user: list, revoke and 404 for foreign ids', async () => {
    const { app, logs } = tokenApp()
    const alice = (await create(app, ALICE)).body.token
    await create(app, BOB, { name: 'bob-ci', scope: 'read', expiresAt: '2026-07-01' })

    const aliceList = await requestJson<ApiTokenView[]>(app, '/api/tokens', 'GET', undefined, ALICE)
    const bobList = await requestJson<ApiTokenView[]>(app, '/api/tokens', 'GET', undefined, BOB)

    expect(aliceList.body.map((token) => token.name)).toEqual(['laptop'])
    expect(bobList.body.map((token) => token.name)).toEqual(['bob-ci'])
    expect(await requestJson(app, `/api/tokens/${alice.id}/revoke`, 'POST', {}, BOB)).toEqual({
      status: 404,
      body: { error: 'not_found' },
    })
    expect((await requestJson(app, '/api/tokens/x/revoke', 'POST', {}, ALICE)).status).toBe(404)

    const revoked = await requestJson<ApiTokenView>(
      app,
      `/api/tokens/${alice.id}/revoke`,
      'POST',
      {},
      ALICE,
    )

    expect(revoked).toMatchObject({ status: 200, body: { revokedAt: '2026-06-01T12:00:00.000Z' } })
    expect(logs.at(-1)).toBe(
      '[sieb] api token revoked: owner="alice" name="laptop" id=1 scope=read',
    )
  })

  it('needs the forward-auth identity', async () => {
    const { app } = tokenApp()

    expect(await requestJson(app, '/api/tokens')).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    })
    expect((await create(app, {})).status).toBe(401)
  })

  it('caps live tokens per user, revoked tokens free a slot', async () => {
    const { app } = tokenApp()

    for (let index = 0; index < MAX_LIVE_TOKENS; index += 1) {
      expect((await create(app, ALICE)).status).toBe(201)
    }

    expect(await create(app, ALICE)).toEqual({ status: 409, body: { error: 'too_many_tokens' } })
    expect((await create(app, BOB)).status).toBe(201)
    expect((await requestJson(app, '/api/tokens/1/revoke', 'POST', {}, ALICE)).status).toBe(200)
    expect((await create(app, ALICE)).status).toBe(201)
  })

  it('answers 404 mcp_disabled while MCP is off and keeps stored tokens', async () => {
    const enabled = tokenApp()
    await create(enabled.app, ALICE)
    const disabled = createApp({ ...enabled.deps, mcpEnabled: false })

    expect(await requestJson(disabled, '/api/tokens', 'GET', undefined, ALICE)).toEqual({
      status: 404,
      body: { error: 'mcp_disabled' },
    })
    expect((await create(disabled, ALICE)).body).toEqual({ error: 'mcp_disabled' })
    expect((await requestJson(disabled, '/api/tokens/1/revoke', 'POST', {}, ALICE)).body).toEqual({
      error: 'mcp_disabled',
    })
    expect(
      (await requestJson<ApiTokenView[]>(enabled.app, '/api/tokens', 'GET', undefined, ALICE)).body,
    ).toHaveLength(1)
  })
})

describe('mcp-info route', () => {
  it('answers the endpoint from the public URL or the request origin', async () => {
    const configured = tokenApp({ publicUrl: 'https://sieb.example.com' }).app
    const derived = tokenApp().app

    expect(await requestJson<McpInfoResponse>(configured, '/api/mcp-info')).toEqual({
      status: 200,
      body: { enabled: true, mcpUrl: 'https://sieb.example.com/mcp', oauth: false },
    })
    expect(
      (
        await requestJson<McpInfoResponse>(
          derived,
          'http://localhost:5173/api/mcp-info',
          'GET',
          undefined,
          {
            'X-Forwarded-Proto': 'https',
          },
        )
      ).body,
    ).toEqual({ enabled: true, mcpUrl: 'https://localhost:5173/mcp', oauth: false })
  })

  it('reports OAuth when configured and nothing while disabled', async () => {
    const oauth = {
      issuer: 'https://auth.example.com/',
      clientId: 'sieb-mcp',
      jwksUrl: null,
      requiredGroup: null,
      clientLabel: 'claude.ai',
    }
    const publicUrl = 'https://sieb.example.com'

    expect((await requestJson(tokenApp({ publicUrl, oauth }).app, '/api/mcp-info')).body).toEqual({
      enabled: true,
      mcpUrl: 'https://sieb.example.com/mcp',
      oauth: true,
    })
    expect(
      (await requestJson(tokenApp({ publicUrl, oauth, mcpEnabled: false }).app, '/api/mcp-info'))
        .body,
    ).toEqual({ enabled: false, mcpUrl: null, oauth: false })
  })
})
