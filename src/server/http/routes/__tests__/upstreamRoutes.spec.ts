// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { DecisionView, FindingView } from '#core/findingView.ts'
import { requestJson, suppressedSeries, syncedTestApp } from '#server/http/__tests__/appFixtures.ts'

const WAITING_FOR = 'k3s release bundling traefik 3.7.17 or later'

/**
 * Creates an app with one finding decided as fix_planned waiting for upstream.
 * @returns {Promise<{ app: Awaited<ReturnType<typeof syncedTestApp>>['app']; finding: FindingView; view: DecisionView }>} - App, finding and decision
 */
const waitingApp = async () => {
  const { app } = await syncedTestApp()
  const { body: findings } = await requestJson<FindingView[]>(app, '/api/findings')
  const finding = findings[0]

  if (!finding) {
    throw new Error('fixtures lack findings')
  }

  const { status, body: view } = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
    vulnId: finding.vulnId,
    scope: 'image',
    imageRef: finding.imageRef,
    status: 'fix_planned',
    reason: 'no fixed k3s yet',
    expiresAt: '2026-07-01',
    upstreamPending: true,
    waitingFor: WAITING_FOR,
  })

  expect(status).toBe(201)
  return { app, finding, view }
}

describe('upstream routes', () => {
  it('creates a waiting decision and answers its fields', async () => {
    const { view } = await waitingApp()

    expect(view.decision).toMatchObject({
      status: 'fix_planned',
      upstreamPending: true,
      waitingFor: WAITING_FOR,
      expiresAt: '2026-07-01T23:59:59.999Z',
    })
  })

  it('refuses a waiting decision without its text or review date', async () => {
    const { app } = await syncedTestApp()
    const body = {
      vulnId: 'CVE-1',
      scope: 'all',
      status: 'fix_planned',
      reason: 'x',
      upstreamPending: true,
    }

    expect(await requestJson(app, '/api/decisions', 'POST', body)).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'waitingFor', code: 'required' }] },
    })
    expect(
      await requestJson(app, '/api/decisions', 'POST', { ...body, waitingFor: 'k3s' }),
    ).toMatchObject({ status: 400, body: { errors: [{ field: 'expiresAt', code: 'required' }] } })
  })

  it('answers 400 for a change that breaks the rules and clears them on another status', async () => {
    const { app, view } = await waitingApp()
    const url = `/api/decisions/${view.decision.id}`

    expect(await requestJson(app, url, 'PATCH', { expiresAt: null })).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'expiresAt', code: 'required' }] },
    })
    expect(await requestJson(app, url, 'PATCH', { status: 'accepted' })).toMatchObject({
      status: 200,
      body: { decision: { status: 'accepted', upstreamPending: false, waitingFor: null } },
    })
  })

  it('filters findings and decisions by waiting for upstream', async () => {
    const { app, finding, view } = await waitingApp()
    const only = await requestJson<FindingView[]>(app, '/api/findings?upstreamPending=true')
    const without = await requestJson<FindingView[]>(app, '/api/findings?upstreamPending=0')
    const decisions = await requestJson<DecisionView[]>(
      app,
      '/api/decisions?state=upstream_pending',
    )

    expect(only.body.map((item) => item.id)).toEqual([finding.id])
    expect(without.body.map((item) => item.id)).not.toContain(finding.id)
    expect(decisions.body.map((item) => item.decision.id)).toEqual([view.decision.id])
    expect((await requestJson(app, '/api/findings?upstreamPending=maybe')).status).toBe(400)
  })

  it('keeps the metrics of a fix_planned decision', async () => {
    const { app, finding } = await waitingApp()

    expect(await suppressedSeries(app)).not.toContainEqual(
      expect.stringContaining(`vuln_id="${finding.vulnId}",image_ref="${finding.imageRef}"`),
    )
  })
})
