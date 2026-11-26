// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CveAggregate } from '#core/cveAggregation.ts'
import type { DecisionView, FindingView } from '#core/findingView.ts'
import { listDecisionEvents } from '#server/db/decisionEventRepository.ts'
import { recordDecisionTransitions } from '#server/sync/recordDecisionTransitions.ts'

import { requestJson, syncedTestApp, TEST_NOW } from '#server/http/__tests__/appFixtures.ts'

describe('re-confirm of a pending re-open', () => {
  it('re-arms an all-scope decision before a sync latched the re-open', async () => {
    const { app, deps } = await syncedTestApp()
    const findings = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body
    const finding = findings.find(
      (candidate) => candidate.severity !== 'Critical' && !candidate.kev,
    )

    if (!finding) {
      throw new Error('inbox lacks a finding below Critical without KEV listing')
    }

    const created = await requestJson<DecisionView>(app, '/api/decisions', 'POST', {
      vulnId: finding.vulnId,
      scope: 'all',
      status: 'accepted',
      reason: 'behind the gateway',
    })
    const id = created.body.decision.id

    deps.db.prepare("UPDATE findings SET severity = 'Critical' WHERE id = ?").run(finding.id)

    const cves = (await requestJson<CveAggregate[]>(app, '/api/cves')).body
    const cve = cves.find((candidate) => candidate.vulnId === finding.vulnId)

    expect(cve?.allScopeDecision?.reopenedAt).toBeNull()
    expect(cve?.allScopeEffective).toMatchObject({
      state: 'reopened',
      reopenedAt: null,
      reason: 'severity_rose',
      imageRef: finding.imageRef,
    })

    const reconfirmed = await requestJson<DecisionView>(app, `/api/decisions/${id}`, 'PATCH', {
      reconfirm: true,
    })

    expect(reconfirmed.status).toBe(200)
    expect(reconfirmed.body.effective).toEqual({ state: 'active' })
    expect(reconfirmed.body.decision).toMatchObject({
      reopenedAt: null,
      severityAtDecision: 'Critical',
    })
    expect(reconfirmed.body.decision.baselines).toContainEqual(
      expect.objectContaining({ imageRef: finding.imageRef, severity: 'Critical' }),
    )

    expect(recordDecisionTransitions(deps.db, TEST_NOW)).toBe(0)
    const after = (await requestJson<DecisionView[]>(app, '/api/decisions')).body

    expect(after.find((view) => view.decision.id === id)?.effective).toEqual({ state: 'active' })
    expect(listDecisionEvents(deps.db, [id]).map((event) => event.type)).toEqual([
      'created',
      'updated',
    ])
  })
})
