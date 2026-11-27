// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { MAX_LIVE_TOKENS, type ApiTokenScope } from '#core/apiToken.ts'
import type { McpInfoResponse } from '#core/mcpApiTypes.ts'
import type {
  ApiTokenCleanupResponse,
  ApiTokenCreateResponse,
  ApiTokenView,
} from '#core/tokenApiTypes.ts'
import { insertToken } from '#server/db/apiTokenWrites.ts'
import { getProposal, insertProposal } from '#server/db/proposalRepository.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'

import { requestJson, TEST_NOW, testAppDeps } from '#server/http/__tests__/appFixtures.ts'

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

/**
 * Sends DELETE /api/tokens/:id.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {Record<string, string>} user - Identity header
 * @param {number | string} id - Token id
 * @returns {Promise<{ status: number; body: unknown }>} - Status and parsed body, null for 204
 */
const deleteToken = async (
  app: ReturnType<typeof createApp>,
  user: Record<string, string>,
  id: number | string,
): Promise<{ status: number; body: unknown }> => {
  const response = await app.request(`/api/tokens/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...user },
  })

  return { status: response.status, body: response.status === 204 ? null : await response.json() }
}

/**
 * Stores a token that expired a day before the test time.
 * @param {AppDeps} deps - App dependencies with the database
 * @param {string} owner - Owner
 * @param {string} name - Token name, also its hash seed
 * @param {ApiTokenScope} scope - Token scope
 * @returns {number} - Token id
 */
const addExpiredToken = (
  deps: AppDeps,
  owner: string,
  name: string,
  scope: ApiTokenScope = 'read',
): number => {
  const result = insertToken(
    deps.db,
    {
      owner,
      input: { name, scope, expiresAt: new Date(TEST_NOW.getTime() - 86_400_000).toISOString() },
      prefix: 'sieb_abcd',
      hash: name.padEnd(64, '0').slice(0, 64),
    },
    new Date(TEST_NOW.getTime() - 30 * 86_400_000),
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.token.id
}

/**
 * Lists the token names of a user through the API.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {Record<string, string>} user - Identity header
 * @returns {Promise<string[]>} - Names, newest first
 */
const tokenNames = async (
  app: ReturnType<typeof createApp>,
  user: Record<string, string>,
): Promise<string[]> =>
  (await requestJson<ApiTokenView[]>(app, '/api/tokens', 'GET', undefined, user)).body.map(
    (token) => token.name,
  )

describe('token deletion', () => {
  it('deletes a revoked or expired own token with 204 and logs it', async () => {
    const { app, logs, deps } = tokenApp()
    const revoked = (
      await create(app, ALICE, { name: 'old', scope: 'read', expiresAt: '2026-07-01' })
    ).body.token
    const expired = addExpiredToken(deps, 'alice', 'gone')

    await requestJson(app, `/api/tokens/${revoked.id}/revoke`, 'POST', {}, ALICE)

    const response = await app.request(`/api/tokens/${revoked.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...ALICE },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(logs.at(-1)).toBe('[sieb] api token deleted: owner="alice" name="old" id=1 scope=read')
    expect(await deleteToken(app, ALICE, expired)).toEqual({ status: 204, body: null })
    expect(await tokenNames(app, ALICE)).toEqual([])
    expect(await deleteToken(app, ALICE, revoked.id)).toEqual({
      status: 404,
      body: { error: 'not_found' },
    })
  })

  it('refuses a live token with 409 token_live and keeps it', async () => {
    const { app, logs } = tokenApp()
    const live = (await create(app, ALICE)).body.token

    expect(await deleteToken(app, ALICE, live.id)).toEqual({
      status: 409,
      body: { error: 'token_live' },
    })
    expect(await tokenNames(app, ALICE)).toEqual(['laptop'])
    expect(logs.some((line) => line.includes('deleted'))).toBe(false)
  })

  it('answers 404 for foreign, unknown and malformed ids', async () => {
    const { app } = tokenApp()
    const bob = (await create(app, BOB, { name: 'bob-ci', scope: 'read', expiresAt: '2026-07-01' }))
      .body.token

    await requestJson(app, `/api/tokens/${bob.id}/revoke`, 'POST', {}, BOB)

    expect((await deleteToken(app, ALICE, bob.id)).status).toBe(404)
    expect((await deleteToken(app, ALICE, 99)).status).toBe(404)
    expect((await deleteToken(app, ALICE, 'x')).status).toBe(404)
    expect(await tokenNames(app, BOB)).toEqual(['bob-ci'])
  })

  it('goes through the write guard and the identity', async () => {
    const { app } = tokenApp()
    const id = (await create(app, ALICE)).body.token.id

    await requestJson(app, `/api/tokens/${id}/revoke`, 'POST', {}, ALICE)

    expect(
      (await app.request(`/api/tokens/${id}`, { method: 'DELETE', headers: ALICE })).status,
    ).toBe(415)
    expect(
      (
        await app.request(`/api/tokens/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', ...ALICE },
        })
      ).status,
    ).toBe(403)
    expect((await deleteToken(app, {}, id)).status).toBe(401)
    expect(await tokenNames(app, ALICE)).toEqual(['laptop'])
  })

  it('keeps the attribution of proposals filed with a deleted token and never reuses its id', async () => {
    const { app, deps } = tokenApp()
    const token = (
      await create(app, ALICE, { name: 'mac', scope: 'propose', expiresAt: '2026-07-01' })
    ).body.token
    const proposalId = insertProposal(deps.db, {
      ...buildProposalInput(),
      ...PROPOSER,
      proposedBy: 'alice',
      tokenId: token.id,
      clientLabel: 'mac',
      imageAccess: [],
      basisDecisions: [],
      createdAt: TEST_NOW.toISOString(),
    })

    await requestJson(app, `/api/tokens/${token.id}/revoke`, 'POST', {}, ALICE)

    expect((await deleteToken(app, ALICE, token.id)).status).toBe(204)
    expect(getProposal(deps.db, proposalId)).toMatchObject({
      proposedBy: 'alice',
      proposedVia: 'token',
      clientLabel: 'mac',
      tokenId: token.id,
      state: 'open',
    })
    expect((await create(app, BOB)).body.token.id).toBe(token.id + 1)
  })

  it('deletes all inactive own tokens on POST /cleanup and answers the count', async () => {
    const { app, logs, deps } = tokenApp()
    const revoked = (
      await create(app, ALICE, { name: 'old', scope: 'read', expiresAt: '2026-07-01' })
    ).body.token

    await create(app, ALICE, { name: 'live', scope: 'read', expiresAt: '2026-07-01' })
    await requestJson(app, `/api/tokens/${revoked.id}/revoke`, 'POST', {}, ALICE)
    addExpiredToken(deps, 'alice', 'gone')
    addExpiredToken(deps, 'bob', 'bob-old')

    expect(
      await requestJson<ApiTokenCleanupResponse>(app, '/api/tokens/cleanup', 'POST', {}, ALICE),
    ).toEqual({ status: 200, body: { deleted: 2 } })
    expect(logs.filter((line) => line.includes('api token deleted'))).toEqual([
      '[sieb] api token deleted: owner="alice" name="old" id=1 scope=read',
      '[sieb] api token deleted: owner="alice" name="gone" id=3 scope=read',
    ])
    expect(await tokenNames(app, ALICE)).toEqual(['live'])
    expect(await tokenNames(app, BOB)).toEqual(['bob-old'])
    expect(
      (await requestJson<ApiTokenCleanupResponse>(app, '/api/tokens/cleanup', 'POST', {}, ALICE))
        .body,
    ).toEqual({ deleted: 0 })
  })
})

describe('mcp-info route', () => {
  it('answers the endpoint from the public URL or the request origin', async () => {
    const configured = tokenApp({ publicUrl: 'https://sieb.example.com' }).app
    const derived = tokenApp().app

    expect(await requestJson<McpInfoResponse>(configured, '/api/mcp-info')).toEqual({
      status: 200,
      body: {
        enabled: true,
        mcpUrl: 'https://sieb.example.com/mcp',
        oauth: false,
        claude: null,
        checksEnabled: false,
      },
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
    ).toEqual({
      enabled: true,
      mcpUrl: 'https://localhost:5173/mcp',
      oauth: false,
      claude: null,
      checksEnabled: false,
    })
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
      claude: null,
      checksEnabled: false,
    })
    expect(
      (await requestJson(tokenApp({ publicUrl, oauth, mcpEnabled: false }).app, '/api/mcp-info'))
        .body,
    ).toEqual({ enabled: false, mcpUrl: null, oauth: false, claude: null, checksEnabled: false })
  })
})
