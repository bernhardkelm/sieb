// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { DecisionView, FindingView } from '#core/findingView.ts'

import {
  requestJson,
  suppressedSeries,
  syncedTestApp,
  TEST_NOW,
} from '#server/http/__tests__/appFixtures.ts'

/**
 * Builds the sieb_suppressed sample line of a finding.
 * @param {string} vulnId - Vulnerability id
 * @param {string} imageRef - Image
 * @returns {string} - Sample line
 */
const series = (vulnId: string, imageRef: string): string =>
  `sieb_suppressed{vuln_id="${vulnId}",image_ref="${imageRef}"} 1`

/**
 * Finds a CVE found in at least two images.
 * @param {Awaited<ReturnType<typeof syncedTestApp>>['app']} app - App
 * @returns {Promise<CveAggregate>} - CVE aggregate
 */
const spreadCve = async (
  app: Awaited<ReturnType<typeof syncedTestApp>>['app'],
): Promise<CveAggregate> => {
  const { body } = await requestJson<CveAggregate[]>(app, '/api/cves')
  const cve = body.find((candidate) => candidate.imageCount >= 3)

  if (!cve) {
    throw new Error('fixtures lack a CVE spanning three images')
  }

  return cve
}

describe('decision routes', () => {
  it('rejects a decision with an empty reason', async () => {
    const { app } = await syncedTestApp()
    const { status, body } = await requestJson(app, '/api/decisions', 'POST', {
      vulnId: 'CVE-1',
      scope: 'all',
      status: 'not_affected',
      reason: '  ',
    })

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'validation', errors: [{ field: 'reason', code: 'required' }] })
  })

  it('takes a decided finding out of the inbox, silences it and revokes it again', async () => {
    const { app } = await syncedTestApp()
    const [finding] = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body

    if (!finding) {
      throw new Error('inbox is empty')
    }

    const input = { vulnId: finding.vulnId, scope: 'image', imageRef: finding.imageRef }
    const created = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
      ...input,
      status: 'accepted',
      reason: 'behind the gateway',
    })
    const inbox = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body
    const id = created.body.decision.id

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ effective: { state: 'active' }, openFindings: 1 })
    expect(created.body.decision.createdBy).toBe('dev')
    expect(inbox.some((candidate) => candidate.id === finding.id)).toBe(false)
    expect(await suppressedSeries(app)).toEqual([series(finding.vulnId, finding.imageRef)])

    const duplicate = await requestJson(app, '/api/decisions', 'POST', {
      ...input,
      status: 'fix_planned',
      reason: 'again',
    })
    expect(duplicate).toEqual({ status: 409, body: { error: 'conflict', decisionId: id } })

    const revoked = await requestJson<DecisionView>(app, `/api/decisions/${id}/revoke`, 'POST', {
      comment: 'wrong call',
    })
    expect(revoked.body.effective.state).toBe('revoked')
    expect(await suppressedSeries(app)).toEqual([])
    expect((await requestJson(app, `/api/decisions/${id}/revoke`, 'POST')).status).toBe(409)
  })

  it('expands an all-scope decision to every open image without its own decision', async () => {
    const { app } = await syncedTestApp()
    const cve = await spreadCve(app)
    const [own, ...rest] = cve.imageRefs

    await requestJson(app, '/api/decisions', 'POST', {
      vulnId: cve.vulnId,
      scope: 'image',
      imageRef: own,
      status: 'fix_planned',
      reason: 'patch next sprint',
    })
    const all = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
      vulnId: cve.vulnId,
      scope: 'all',
      status: 'not_affected',
      reason: 'feature unused',
    })

    expect(all.status).toBe(201)
    expect(all.body.openFindings).toBe(rest.length)
    expect(await suppressedSeries(app)).toEqual(
      rest.map((imageRef) => series(cve.vulnId, imageRef)),
    )
  })

  it('reports unknown images and ids', async () => {
    const { app } = await syncedTestApp()
    const unknown = await requestJson(app, '/api/decisions', 'POST', {
      vulnId: 'CVE-1999-0001',
      scope: 'image',
      imageRef: 'nowhere/image',
      status: 'not_affected',
      reason: 'x',
    })

    expect(unknown.body).toEqual({
      error: 'validation',
      errors: [{ field: 'imageRef', code: 'unknown_finding' }],
    })
    expect((await requestJson(app, '/api/decisions/77', 'PATCH', { reason: 'y' })).status).toBe(404)
  })

  it('changes the expiry and filters expiring decisions', async () => {
    const { app } = await syncedTestApp()
    const [finding] = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body
    const created = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
      vulnId: finding?.vulnId,
      scope: 'image',
      imageRef: finding?.imageRef,
      status: 'accepted',
      reason: 'risk accepted',
    })
    const id = created.body.decision.id
    const soon = new Date(TEST_NOW.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString()

    expect((await requestJson(app, '/api/decisions?state=expiring')).body).toEqual([])

    const patched = await requestJson<DecisionView>(app, `/api/decisions/${id}`, 'PATCH', {
      expiresAt: soon,
    })
    const expiring = await requestJson<DecisionView[]>(app, '/api/decisions?state=expiring')

    expect(patched.body.decision.expiresAt).toBe(soon)
    expect(expiring.body.map((view) => view.decision.id)).toEqual([id])
    expect((await requestJson(app, '/api/decisions?state=active')).body).toHaveLength(1)
    expect((await requestJson(app, '/api/decisions?state=soon')).status).toBe(400)
    expect(
      (await requestJson(app, `/api/decisions/${id}`, 'PATCH', { expiresAt: '2020-01-01' })).status,
    ).toBe(400)
  })

  it('stores, lists, validates and clears a not_affected justification', async () => {
    const { app } = await syncedTestApp()
    const cve = await spreadCve(app)
    const input = { vulnId: cve.vulnId, scope: 'all', reason: 'feature unused' }

    expect(
      await requestJson(app, '/api/decisions', 'POST', {
        ...input,
        status: 'accepted',
        justification: 'component_not_present',
      }),
    ).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'justification', code: 'not_allowed' }] },
    })
    expect(
      await requestJson(app, '/api/decisions', 'POST', {
        ...input,
        status: 'not_affected',
        justification: 'false_positive',
      }),
    ).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'justification', code: 'invalid' }] },
    })

    const created = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
      ...input,
      status: 'not_affected',
      justification: 'vulnerable_code_not_present',
    })
    const id = created.body.decision.id
    const listed = await requestJson<DecisionView[]>(app, '/api/decisions')
    const [imageRef] = cve.imageRefs
    const findings = await requestJson<FindingView[]>(app, '/api/findings?view=all')
    const finding = findings.body.find(
      (candidate) => candidate.vulnId === cve.vulnId && candidate.imageRef === imageRef,
    )
    const detail = await requestJson<{ decisions: DecisionView[] }>(
      app,
      `/api/findings/${finding?.id}`,
    )

    expect(created.status).toBe(201)
    expect(created.body.decision.justification).toBe('vulnerable_code_not_present')
    expect(listed.body.find((view) => view.decision.id === id)?.decision.justification).toBe(
      'vulnerable_code_not_present',
    )
    expect(detail.body.decisions[0]?.decision.justification).toBe('vulnerable_code_not_present')
    expect(await suppressedSeries(app)).toHaveLength(cve.imageRefs.length)

    const cleared = await requestJson<DecisionView>(app, `/api/decisions/${id}`, 'PATCH', {
      status: 'accepted',
    })

    expect(cleared.body.decision).toMatchObject({ status: 'accepted', justification: null })
    expect(
      await requestJson(app, `/api/decisions/${id}`, 'PATCH', {
        justification: 'component_not_present',
      }),
    ).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'justification', code: 'not_allowed' }] },
    })
    expect(
      (
        await requestJson<DecisionView>(app, `/api/decisions/${id}`, 'PATCH', {
          status: 'not_affected',
          justification: 'inline_mitigations_already_exist',
        })
      ).body.decision.justification,
    ).toBe('inline_mitigations_already_exist')
  })
})
