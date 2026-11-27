// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { McpInfoResponse } from '#core/apiTypes.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { checkFixture, PUBLIC_URL } from '#server/checks/__tests__/checkFixtures.ts'
import { claimForWorker, recordResult } from '#server/checks/workerCommands.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import type { AppDeps } from '#server/http/createApp.ts'
import { createApp } from '#server/http/createApp.ts'

/**
 * Creates the main app with Auto-check on over a check fixture.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {ReturnType<typeof checkFixture> & { app: ReturnType<typeof createApp> }} - Fixture and app
 */
const setup = (overrides: Partial<AppDeps> = {}) => {
  const fixture = checkFixture()
  const app = createApp(
    testAppDeps({
      db: fixture.db,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
      ...overrides,
    }),
  )

  return { ...fixture, app }
}

describe('GET /api/checks', () => {
  it('answers the running check, the queue in order and the newest ended checks', async () => {
    const { app, context, findings } = setup()

    await requestJson(app, '/api/checks', 'POST', { findingIds: [findings.nginx, findings.redis] })
    const id = claimForWorker(context)?.checkId ?? 0
    const response = await app.request('/api/checks')
    const body = (await response.json()) as ChecksResponse

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({ enabled: true, workerOnline: false, recent: [] })
    expect(body.running).toMatchObject({ id, state: 'running', phase: 'preparing', position: null })
    expect(body.queued.map((check) => [check.findingId, check.position])).toEqual([
      [findings.redis, 1],
    ])

    recordResult(context, id, {
      status: 'done',
      error: null,
      durationMs: 5,
      usage: null,
      reply: null,
    })

    const after = (await requestJson<ChecksResponse>(app, '/api/checks')).body

    expect(after.running).toBeNull()
    expect(after.recent.map((check) => [check.id, check.state, check.phase])).toEqual([
      [id, 'done', null],
    ])
  })

  it('lists at most 50 ended checks, newest first', async () => {
    const { app, context, findings, advance } = setup()

    for (let round = 0; round < 52; round += 1) {
      await requestJson(app, '/api/checks', 'POST', { findingIds: [findings.nginx] })
      const id = claimForWorker(context)?.checkId ?? 0

      advance(1000)
      recordResult(context, id, {
        status: 'done',
        error: null,
        durationMs: 1,
        usage: null,
        reply: null,
      })
    }

    const { recent } = (await requestJson<ChecksResponse>(app, '/api/checks')).body

    expect(recent).toHaveLength(50)
    expect(recent[0]?.id).toBe(52)
    expect(recent[49]?.id).toBe(3)
  })
})

describe('POST /api/checks', () => {
  it('queues findings for the acting user', async () => {
    const { app, findings } = setup()
    const { status, body } = await requestJson<CheckCreateResponse>(
      app,
      '/api/checks',
      'POST',
      { findingIds: [findings.nginx, findings.own, findings.nginx] },
      { 'X-authentik-username': 'alice' },
    )

    expect(status).toBe(200)
    expect(body.queued.map((check) => [check.findingId, check.requestedBy])).toEqual([
      [findings.nginx, 'alice'],
    ])
    expect(body.skipped).toEqual([{ findingId: findings.own, reason: 'not_public' }])
  })

  it('validates the finding ids', async () => {
    const { app } = setup()
    const bodies = [{}, { findingIds: [] }, { findingIds: [0] }, { findingIds: ['1'] }]

    for (const body of bodies) {
      expect((await requestJson(app, '/api/checks', 'POST', body)).status).toBe(400)
    }

    const tooMany = Array.from({ length: 101 }, (_, index) => index + 1)

    expect((await requestJson(app, '/api/checks', 'POST', { findingIds: tooMany })).body).toEqual({
      error: 'validation',
      errors: [{ field: 'findingIds', code: 'too_many' }],
    })
  })

  it('needs an acting user and a JSON write', async () => {
    const { app, findings } = setup({ devUser: null })
    const plain = await app.request('/api/checks', {
      method: 'POST',
      body: JSON.stringify({ findingIds: [findings.nginx] }),
    })

    expect(plain.status).toBe(415)
    expect((await requestJson(app, '/api/checks', 'POST', { findingIds: [1] })).status).toBe(401)
    expect((await requestJson(app, '/api/checks/1', 'DELETE')).status).toBe(401)
  })
})

describe('DELETE /api/checks/:id', () => {
  it('cancels queued checks and refuses ended and unknown ones', async () => {
    const { app, findings } = setup()
    const { body } = await requestJson<CheckCreateResponse>(app, '/api/checks', 'POST', {
      findingIds: [findings.nginx],
    })
    const path = `/api/checks/${body.queued[0]?.id}`

    expect(
      (
        await app.request(path, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        })
      ).status,
    ).toBe(204)
    expect(await requestJson(app, path, 'DELETE')).toEqual({
      status: 409,
      body: { error: 'check_finished' },
    })
    expect((await requestJson(app, '/api/checks/9999', 'DELETE')).status).toBe(404)
    expect((await requestJson(app, '/api/checks/abc', 'DELETE')).status).toBe(404)
  })
})

describe('Auto-check switched off', () => {
  it('answers an empty overview and refuses writes with checks_disabled', async () => {
    const app = createApp(testAppDeps({ mcpEnabled: true }))

    expect((await requestJson<ChecksResponse>(app, '/api/checks')).body).toEqual({
      enabled: false,
      workerOnline: false,
      running: null,
      queued: [],
      recent: [],
      usage: null,
    })
    expect(await requestJson(app, '/api/checks', 'POST', { findingIds: [1] })).toEqual({
      status: 404,
      body: { error: 'checks_disabled' },
    })
    expect((await requestJson(app, '/api/checks/1', 'DELETE')).status).toBe(404)
    expect((await requestJson<McpInfoResponse>(app, '/api/mcp-info')).body.checksEnabled).toBe(
      false,
    )
  })

  it('reports checksEnabled in the MCP info when on', async () => {
    const { app } = setup()

    expect((await requestJson<McpInfoResponse>(app, '/api/mcp-info')).body.checksEnabled).toBe(true)
  })
})
