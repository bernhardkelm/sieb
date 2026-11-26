// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DecisionView, FindingView } from '#core/findingView.ts'
import { DEFAULT_USER_HEADER, readActor } from '#server/http/identity.ts'

import { requestJson, syncedTestApp } from './appFixtures.ts'

describe('readActor', () => {
  it('prefers the auth header and falls back to the dev user', () => {
    const header = DEFAULT_USER_HEADER

    expect(readActor(new Headers({ 'X-authentik-username': 'alice' }), header, 'dev')).toBe('alice')
    expect(readActor(new Headers(), header, 'dev')).toBe('dev')
    expect(readActor(new Headers({ 'X-authentik-username': ' ' }), header, null)).toBeNull()
  })

  it('reads the configured header only', () => {
    const headers = new Headers({ 'X-authentik-username': 'mallory', 'X-Forwarded-User': 'alice' })

    expect(readActor(headers, 'X-Forwarded-User', null)).toBe('alice')
    expect(
      readActor(new Headers({ 'X-authentik-username': 'mallory' }), 'X-Forwarded-User', null),
    ).toBeNull()
  })
})

describe('identity middleware', () => {
  it('answers anonymous writes 401 without a dev user and keeps reads and /metrics open', async () => {
    const { app } = await syncedTestApp({ devUser: null })
    const metrics = await app.request('/metrics')

    expect(await requestJson(app, '/api/me')).toEqual({
      status: 200,
      body: { username: null, authMode: 'header' },
    })
    expect((await requestJson(app, '/api/findings')).status).toBe(200)
    expect(metrics.status).toBe(200)
    expect(metrics.headers.get('Content-Type')).toBe('text/plain; version=0.0.4; charset=utf-8')
    expect(await requestJson(app, '/api/decisions', 'POST', {})).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    })
    expect((await requestJson(app, '/api/sync', 'POST')).status).toBe(401)
  })

  it('records the header user as the actor', async () => {
    const { app } = await syncedTestApp({ devUser: null })
    const headers = { 'X-authentik-username': 'alice' }
    const [finding] = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body
    const created = await requestJson<DecisionView>(
      app,
      '/api/decisions',
      'POST',
      { vulnId: finding?.vulnId, scope: 'all', status: 'fix_planned', reason: 'upgrade' },
      headers,
    )

    expect(created.body.decision.createdBy).toBe('alice')
    expect((await requestJson(app, '/api/me', 'GET', undefined, headers)).body).toEqual({
      username: 'alice',
      authMode: 'header',
    })
  })
})
