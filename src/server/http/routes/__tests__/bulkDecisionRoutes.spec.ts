// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { BulkDecisionResult } from '#core/apiTypes.ts'
import type { CveAggregate } from '#core/cveAggregation.ts'
import type { DecisionView } from '#core/findingView.ts'

import { requestJson, suppressedSeries, syncedTestApp } from '#server/http/__tests__/appFixtures.ts'

describe('bulk decision route', () => {
  it('decides every open image of a CVE and skips decided and unknown images', async () => {
    const { app } = await syncedTestApp()
    const cve = (await requestJson<CveAggregate[]>(app, '/api/cves')).body.find(
      (candidate) => candidate.imageCount >= 3,
    )

    if (!cve) {
      throw new Error('fixtures lack a CVE spanning three images')
    }

    const [decided, ...rest] = cve.imageRefs
    const existing = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
      vulnId: cve.vulnId,
      scope: 'image',
      imageRef: decided,
      status: 'fix_planned',
      reason: 'patch first',
    })
    const bulk = await requestJson<BulkDecisionResult>(app, '/api/decisions/bulk', 'POST', {
      vulnId: cve.vulnId,
      imageRefs: [...cve.imageRefs, 'nowhere/image'],
      status: 'not_affected',
      reason: 'code path unused',
    })

    expect(bulk.status).toBe(200)
    expect(bulk.body.created.map((view) => view.decision.imageRef)).toEqual(rest)
    expect(bulk.body.created.every((view) => view.effective.state === 'active')).toBe(true)
    expect(bulk.body.skipped).toEqual([
      { imageRef: decided, reason: 'decided', decisionId: existing.body.decision.id },
      { imageRef: 'nowhere/image', reason: 'unknown_finding', decisionId: null },
    ])
    expect(await suppressedSeries(app)).toHaveLength(rest.length)

    const again = await requestJson<BulkDecisionResult>(app, '/api/decisions/bulk', 'POST', {
      vulnId: cve.vulnId,
      imageRefs: 'all-open',
      status: 'accepted',
      reason: 'again',
    })

    expect(again.body.created).toEqual([])
    expect(again.body.skipped).toHaveLength(cve.imageCount)
  })

  it('rejects a bulk without images', async () => {
    const { app } = await syncedTestApp()

    expect(
      await requestJson(app, '/api/decisions/bulk', 'POST', {
        vulnId: 'CVE-1',
        imageRefs: [],
        status: 'accepted',
        reason: 'x',
      }),
    ).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'imageRefs', code: 'invalid' }] },
    })
  })
})
