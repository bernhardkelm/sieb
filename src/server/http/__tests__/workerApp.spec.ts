// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { WorkerClaim } from '#core/check.ts'
import { checkFixture, PUBLIC_URL } from '#server/checks/__tests__/checkFixtures.ts'
import { queueForUser } from '#server/checks/userCommands.ts'
import { testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { createWorkerApp, MAX_WORKER_BODY_BYTES } from '#server/http/workerApp.ts'

const SECRET = 'worker-secret-0123456789abcdefghijklmnop'
const AUTH = { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }
const RESULT = { status: 'done', error: null, durationMs: 1000, usage: null, reply: 'Done.' }

/**
 * Creates the worker app and the main app over one check fixture.
 * @returns {ReturnType<typeof checkFixture> & { worker: ReturnType<typeof createWorkerApp>; main: ReturnType<typeof createApp> }} - Fixture and both apps
 */
const setup = () => {
  const fixture = checkFixture()
  const worker = createWorkerApp({ context: fixture.context, secret: SECRET, log: () => {} })
  const main = createApp(
    testAppDeps({
      db: fixture.db,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
    }),
  )

  return { ...fixture, worker, main }
}

/**
 * Posts a JSON body to the worker app with the worker secret.
 * @param {ReturnType<typeof createWorkerApp>} app - Worker app
 * @param {string} path - Request path
 * @param {unknown} body - JSON body
 * @returns {Promise<Response>} - Response
 */
const post = (app: ReturnType<typeof createWorkerApp>, path: string, body: unknown = {}) =>
  app.request(path, { method: 'POST', headers: AUTH, body: JSON.stringify(body) })

describe('worker auth', () => {
  it('answers 401 without the secret, with a wrong one and with another scheme', async () => {
    const { worker, context } = setup()
    const headers: Record<string, string>[] = [
      {},
      { Authorization: `Bearer ${SECRET}x` },
      { Authorization: `Bearer ${SECRET.slice(0, -1)}` },
      { Authorization: `Basic ${SECRET}` },
      { Authorization: SECRET },
    ]

    for (const header of headers) {
      const response = await worker.request('/worker/claim', { method: 'POST', headers: header })

      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe('Bearer')
    }

    expect(context.presence.online(context.clock())).toBe(false)
  })

  it('serves nothing but /worker', async () => {
    const { worker } = setup()

    for (const path of ['/api/checks', '/metrics', '/mcp', '/']) {
      expect((await worker.request(path, { headers: AUTH })).status).toBe(404)
    }

    expect((await worker.request('/worker/claim', { headers: AUTH })).status).toBe(404)
  })

  it('is not served on the main port', async () => {
    const { main } = setup()

    for (const path of ['/worker/claim', '/worker/checks/1/heartbeat', '/worker/checks/1/result']) {
      expect((await main.request(path, { method: 'POST', headers: AUTH })).status).toBe(404)
    }
  })
})

describe('worker routes', () => {
  it('answers 204 for an empty queue and marks the worker online', async () => {
    const { worker, context } = setup()
    const response = await post(worker, '/worker/claim')

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(context.presence.online(context.clock())).toBe(true)
  })

  it('claims, beats and reports a check', async () => {
    const { worker, context, findings } = setup()

    queueForUser(context, 'alice', [findings.nginx])

    const response = await post(worker, '/worker/claim')
    const claim = (await response.json()) as WorkerClaim

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(claim.token).toMatch(/^sieb_/)

    const beat = `/worker/checks/${claim.checkId}/heartbeat`

    expect((await post(worker, beat, { phase: 'investigating' })).status).toBe(204)
    expect((await post(worker, beat, { phase: 'sleeping' })).status).toBe(400)
    expect((await post(worker, `/worker/checks/${claim.checkId}/result`, RESULT)).status).toBe(204)
    expect((await post(worker, beat, { phase: 'reporting' })).status).toBe(409)
    expect((await post(worker, `/worker/checks/${claim.checkId}/result`, RESULT)).status).toBe(409)
    expect((await post(worker, '/worker/checks/9999/result', RESULT)).status).toBe(404)
  })

  it('answers 409 to the heartbeat of a check cancelled through the client API', async () => {
    const { worker, main, context, findings } = setup()

    queueForUser(context, 'alice', [findings.nginx])
    const claim = (await (await post(worker, '/worker/claim')).json()) as WorkerClaim
    const cancel = await main.request(`/api/checks/${claim.checkId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(cancel.status).toBe(204)
    expect(
      (await post(worker, `/worker/checks/${claim.checkId}/heartbeat`, { phase: 'reporting' }))
        .status,
    ).toBe(409)
  })

  it('validates result bodies and caps their size', async () => {
    const { worker, context, findings } = setup()

    queueForUser(context, 'alice', [findings.nginx])
    const claim = (await (await post(worker, '/worker/claim')).json()) as WorkerClaim
    const path = `/worker/checks/${claim.checkId}/result`

    expect((await post(worker, path, { ...RESULT, status: 'maybe' })).status).toBe(400)
    expect((await post(worker, path, { ...RESULT, durationMs: -1 })).status).toBe(400)
    expect((await post(worker, path, { ...RESULT, usage: { turns: 1 } })).status).toBe(400)
    expect((await post(worker, path, [RESULT])).status).toBe(400)
    expect(
      (await post(worker, path, { ...RESULT, reply: 'x'.repeat(MAX_WORKER_BODY_BYTES) })).status,
    ).toBe(413)
    expect((await post(worker, path, { ...RESULT, reply: 'y'.repeat(9000) })).status).toBe(204)
  })
})
