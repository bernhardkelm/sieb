// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkerClaim } from '#core/check.ts'
import { checkFixture, PUBLIC_URL, START } from '#server/checks/__tests__/checkFixtures.ts'
import { cancelForUser, queueForUser } from '#server/checks/userCommands.ts'
import { testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { createWorkerApp } from '#server/http/workerApp.ts'

const SECRET = 'worker-secret-0123456789abcdefghijklmnop'
const WORKER = { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }
const RESULT = { status: 'done', error: null, durationMs: 1000, usage: null, reply: 'Done.' }
const TOOLS_LIST = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }

/**
 * Creates both apps over one check fixture and claims a check of nginx through the worker app.
 * @returns {Promise<ReturnType<typeof checkFixture> & { worker: ReturnType<typeof createWorkerApp>; main: ReturnType<typeof createApp>; claim: WorkerClaim }>} - Fixture, both apps and the claim
 */
const claimed = async () => {
  const fixture = checkFixture()
  const worker = createWorkerApp({ context: fixture.context, secret: SECRET, log: () => {} })
  const main = createApp(
    testAppDeps({
      db: fixture.db,
      devUser: null,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
    }),
  )

  queueForUser(fixture.context, 'alice', [fixture.findings.nginx])

  const response = await worker.request('/worker/claim', { method: 'POST', headers: WORKER })
  const claim = (await response.json()) as WorkerClaim

  return { ...fixture, worker, main, claim }
}

/**
 * Posts a tools/list JSON-RPC message to /mcp with a bearer token.
 * @param {ReturnType<typeof createApp>} app - Main app
 * @param {string} token - Bearer token
 * @returns {Promise<Response>} - Response
 */
const listTools = async (app: ReturnType<typeof createApp>, token: string): Promise<Response> =>
  await app.request('/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(TOOLS_LIST),
  })

describe('check token on /mcp', () => {
  beforeEach(() => {
    // the MCP SDK checks token expiry against Date.now, the token expires relative to START
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('works while the check runs and answers 401 once the worker posts its result', async () => {
    const { worker, main, claim } = await claimed()

    expect((await listTools(main, claim.token)).status).toBe(200)

    const result = await worker.request(`/worker/checks/${claim.checkId}/result`, {
      method: 'POST',
      headers: WORKER,
      body: JSON.stringify(RESULT),
    })

    expect(result.status).toBe(204)

    const after = await listTools(main, claim.token)

    expect(after.status).toBe(401)
    expect(after.headers.get('WWW-Authenticate')).toMatch(/^Bearer error="invalid_token"/)
  })

  it('answers 401 once the running check is cancelled', async () => {
    const { main, context, claim } = await claimed()

    expect((await listTools(main, claim.token)).status).toBe(200)
    expect(cancelForUser(context, 'alice', claim.checkId)).toBe('cancelled')
    expect((await listTools(main, claim.token)).status).toBe(401)
  })

  it('answers 401 once the running check is cancelled through the client API', async () => {
    const { main, claim } = await claimed()

    expect((await listTools(main, claim.token)).status).toBe(200)

    const cancel = await main.request(`/api/checks/${claim.checkId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-authentik-username': 'alice' },
    })

    expect(cancel.status).toBe(204)
    expect((await listTools(main, claim.token)).status).toBe(401)
  })
})
