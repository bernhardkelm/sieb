// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { ClaudeConnection, McpInfoResponse } from '#core/apiTypes.ts'
import { hashTokenSecret } from '#server/auth/tokenSecrets.ts'
import { insertToken, revokeOwnToken } from '#server/db/apiTokenRepository.ts'
import { recordMcpConnection } from '#server/db/mcpConnectionRepository.ts'
import { OAUTH_CONNECTION_WINDOW_MS } from '#server/db/readClaudeConnection.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'

import { requestJson, TEST_NOW, testAppDeps } from '#server/http/__tests__/appFixtures.ts'

const ALICE = { 'X-authentik-username': 'alice' }
const BOB = { 'X-authentik-username': 'bob' }
const DISCONNECTED: ClaudeConnection = { connected: false, activeTokens: 0, oauthLastSeenAt: null }

/**
 * Creates an app with MCP enabled and no dev user.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {{ app: ReturnType<typeof createApp>; deps: AppDeps }} - App and dependencies
 */
const infoApp = (
  overrides: Partial<AppDeps> = {},
): { app: ReturnType<typeof createApp>; deps: AppDeps } => {
  const deps = testAppDeps({ devUser: null, mcpEnabled: true, ...overrides })

  return { app: createApp(deps), deps }
}

/**
 * Stores a token of an owner directly, expiring at the given time.
 * @param {AppDeps} deps - App dependencies
 * @param {string} owner - Owner
 * @param {string} expiresAt - Expiry, ISO time
 * @returns {number} - Token id
 */
const storeToken = (deps: AppDeps, owner: string, expiresAt: string): number => {
  const result = insertToken(
    deps.db,
    {
      owner,
      input: { name: `${owner}-${expiresAt}`, scope: 'read', expiresAt },
      prefix: 'sieb_prefix',
      hash: hashTokenSecret(`${owner}-${expiresAt}`),
    },
    new Date('2026-05-01T00:00:00.000Z'),
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.token.id
}

/**
 * Reads the Claude connection the route answers a user.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {Record<string, string>} user - Identity header
 * @returns {Promise<ClaudeConnection | null>} - Connection of the response
 */
const claudeOf = async (
  app: ReturnType<typeof createApp>,
  user: Record<string, string>,
): Promise<ClaudeConnection | null> =>
  (await requestJson<McpInfoResponse>(app, '/api/mcp-info', 'GET', undefined, user)).body.claude

describe('mcp-info Claude connection', () => {
  it('reports a disconnected user without tokens or MCP requests, uncached', async () => {
    const { app } = infoApp()
    const response = await app.request('/api/mcp-info', { headers: ALICE })

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(((await response.json()) as McpInfoResponse).claude).toEqual(DISCONNECTED)
  })

  it('counts only live tokens: revoked and expired ones do not connect', async () => {
    const { app, deps } = infoApp()
    const revoked = storeToken(deps, 'alice', '2026-07-01T00:00:00.000Z')

    revokeOwnToken(deps.db, 'alice', revoked, TEST_NOW)
    storeToken(deps, 'alice', '2026-06-01T11:59:59.999Z')

    expect(await claudeOf(app, ALICE)).toEqual(DISCONNECTED)

    storeToken(deps, 'alice', '2026-06-01T12:00:00.001Z')
    storeToken(deps, 'alice', '2026-08-01T00:00:00.000Z')

    expect(await claudeOf(app, ALICE)).toEqual({
      connected: true,
      activeTokens: 2,
      oauthLastSeenAt: null,
    })
  })

  it('connects through an OAuth request within 30 days, not an older one', async () => {
    const { app, deps } = infoApp()
    const edge = new Date(TEST_NOW.getTime() - OAUTH_CONNECTION_WINDOW_MS)
    const older = new Date(edge.getTime() - 1)

    recordMcpConnection(deps.db, { username: 'alice', via: 'oauth' }, older)

    expect(await claudeOf(app, ALICE)).toEqual({
      ...DISCONNECTED,
      oauthLastSeenAt: older.toISOString(),
    })

    recordMcpConnection(deps.db, { username: 'alice', via: 'oauth' }, edge)

    expect(await claudeOf(app, ALICE)).toEqual({
      connected: true,
      activeTokens: 0,
      oauthLastSeenAt: edge.toISOString(),
    })
  })

  it('ignores token requests without a live token, they leave nothing to reach sieb with', async () => {
    const { app, deps } = infoApp()

    recordMcpConnection(deps.db, { username: 'alice', via: 'token' }, TEST_NOW)

    expect(await claudeOf(app, ALICE)).toEqual(DISCONNECTED)
  })

  it('keeps users apart and answers null when anonymous or disabled', async () => {
    const { app, deps } = infoApp()

    storeToken(deps, 'alice', '2026-08-01T00:00:00.000Z')
    recordMcpConnection(deps.db, { username: 'alice', via: 'oauth' }, TEST_NOW)

    expect((await claudeOf(app, ALICE))?.connected).toBe(true)
    expect(await claudeOf(app, BOB)).toEqual(DISCONNECTED)
    expect(await claudeOf(app, {})).toBeNull()
    expect(await claudeOf(infoApp({ mcpEnabled: false }).app, ALICE)).toBeNull()
  })
})
