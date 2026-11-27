// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Hono } from 'hono'

import type {
  ProposalAcceptResponse,
  ProposalDetail,
  ProposalListItem,
} from '#core/proposalApiTypes.ts'
import type { StatsResponse } from '#core/statsApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/registryHost.ts'
import { createProposal } from '#server/db/createProposal.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import {
  requestJson,
  suppressedSeries,
  syncedTestApp,
  TEST_NOW,
} from '#server/http/__tests__/appFixtures.ts'

/**
 * Starts a synced app with an inconclusive proposal for the first finding of the inbox.
 * @returns {Promise<{ app: Hono<AppEnv>; finding: FindingView; id: number }>} - App, finding and proposal id
 */
const appWithInconclusive = async (): Promise<{
  app: Hono<AppEnv>
  finding: FindingView
  id: number
}> => {
  const { app, deps } = await syncedTestApp()
  const [finding] = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body

  if (!finding) {
    throw new Error('inbox is empty')
  }

  const result = createProposal(
    deps.db,
    buildProposalInput({
      vulnId: finding.vulnId,
      imageRefs: [finding.imageRef],
      verdict: 'inconclusive',
      justification: null,
      confidence: 'low',
      missing: ['pull access to registry.example.com/app'],
    }),
    { proposer: PROPOSER, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: TEST_NOW },
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return { app, finding, id: result.proposal.id }
}

/**
 * Reads what alerts, stats and the inbox show.
 * @param {Hono<AppEnv>} app - App
 * @returns {Promise<unknown>} - Suppressed series, current stats and inbox ids
 */
const observable = async (app: Hono<AppEnv>): Promise<unknown> => ({
  metrics: await suppressedSeries(app),
  stats: (await requestJson<StatsResponse>(app, '/api/stats')).body.current,
  inbox: (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body.map((f) => f.id),
})

describe('inconclusive proposal routes', () => {
  it('lists it as open with what is missing and no decision values, metrics untouched', async () => {
    const { app, id } = await appWithInconclusive()
    const { app: fresh } = await syncedTestApp()
    const list = await requestJson<ProposalListItem[]>(app, '/api/proposals')
    const detail = await requestJson<ProposalDetail>(app, `/api/proposals/${id}`)

    expect(list.body.map((item) => item.proposal.id)).toEqual([id])
    expect(detail.body.proposal).toMatchObject({
      verdict: 'inconclusive',
      missing: ['pull access to registry.example.com/app'],
    })
    expect(detail.body.decisionValues).toBeNull()
    expect(await observable(app)).toEqual(await observable(fresh))
  })

  it('refuses a plain accept as not_acceptable and leaves alerts as they are', async () => {
    const { app, finding, id } = await appWithInconclusive()
    const before = await observable(app)
    const expectedDecisionIds = [{ imageRef: finding.imageRef, decisionId: null, updatedAt: null }]
    const plain = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      expectedDecisionIds,
    })
    const reasonOnly = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      expectedDecisionIds,
      edits: { reason: 'Looks fine' },
    })
    const noReason = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      expectedDecisionIds,
      edits: { status: 'accepted' },
    })

    expect(plain).toEqual({ status: 409, body: { error: 'not_acceptable' } })
    expect(reasonOnly).toEqual({ status: 409, body: { error: 'not_acceptable' } })
    expect(noReason).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'edits.reason', code: 'required' }] },
    })
    expect(await observable(app)).toEqual(before)
  })

  it('writes the decision the reviewer sets', async () => {
    const { app, finding, id } = await appWithInconclusive()
    const accepted = await requestJson<ProposalAcceptResponse>(
      app,
      `/api/proposals/${id}/accept`,
      'POST',
      {
        expectedDecisionIds: [{ imageRef: finding.imageRef, decisionId: null, updatedAt: null }],
        edits: {
          status: 'not_affected',
          justification: 'component_not_present',
          reason: 'Checked the image by hand',
        },
      },
    )

    expect(accepted).toMatchObject({
      status: 200,
      body: {
        proposal: { state: 'accepted', resolution: 'accepted_edited' },
        decisions: [{ decision: { status: 'not_affected', reason: 'Checked the image by hand' } }],
      },
    })
  })

  it('dismisses through reject with a reason', async () => {
    const { app, id } = await appWithInconclusive()
    const dismissed = await requestJson(app, `/api/proposals/${id}/reject`, 'POST', {
      reason: 'Not worth a re-check',
    })
    const closed = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      expectedDecisionIds: [],
    })

    expect(dismissed).toMatchObject({
      status: 200,
      body: { proposal: { state: 'rejected', resolutionNote: 'Not worth a re-check' } },
    })
    expect(closed).toEqual({ status: 409, body: { error: 'proposal_closed', state: 'rejected' } })
  })
})
