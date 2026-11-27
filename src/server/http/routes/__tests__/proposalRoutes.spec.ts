// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Hono } from 'hono'

import type {
  ProposalAcceptResponse,
  ProposalDetail,
  ProposalListItem,
  ProposalRejectResponse,
} from '#core/proposalApiTypes.ts'
import type { StatsResponse } from '#core/statsApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { createProposal } from '#server/db/createProposal.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { AppDeps } from '#server/http/createApp.ts'
import {
  requestJson,
  suppressedSeries,
  syncedTestApp,
  TEST_NOW,
} from '#server/http/__tests__/appFixtures.ts'

/**
 * Starts a synced app with a proposal for the first finding of the inbox.
 * @returns {Promise<{ app: Hono<AppEnv>; deps: AppDeps; finding: FindingView; id: number; lines: string[] }>} - App, finding, proposal id and log lines
 */
const appWithProposal = async (): Promise<{
  app: Hono<AppEnv>
  deps: AppDeps
  finding: FindingView
  id: number
  lines: string[]
}> => {
  const lines: string[] = []
  const { app, deps } = await syncedTestApp({ log: (line) => lines.push(line) })
  const [finding] = (await requestJson<FindingView[]>(app, '/api/findings?view=inbox')).body

  if (!finding) {
    throw new Error('inbox is empty')
  }

  const result = createProposal(
    deps.db,
    buildProposalInput({ vulnId: finding.vulnId, imageRefs: [finding.imageRef] }),
    { proposer: PROPOSER, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: TEST_NOW },
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return { app, deps, finding, id: result.proposal.id, lines }
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

describe('proposal routes', () => {
  it('lists open proposals and filters by state and vulnId', async () => {
    const { app, finding, id } = await appWithProposal()
    const open = await requestJson<ProposalListItem[]>(app, '/api/proposals')
    const other = await requestJson<ProposalListItem[]>(app, '/api/proposals?vulnId=CVE-0')
    const rejected = await requestJson<ProposalListItem[]>(app, '/api/proposals?state=rejected')
    const invalid = await requestJson(app, '/api/proposals?state=maybe')

    expect(open.body).toMatchObject([
      {
        proposal: { id, vulnId: finding.vulnId },
        outdated: false,
        imageCount: 1,
        severity: finding.severity,
      },
    ])
    expect(open.body[0]?.proposal).toMatchObject({
      proposedVia: 'token',
      clientLabel: 'laptop',
      clientKind: 'claude_code_cli',
    })
    expect(open.body[0]?.proposal).not.toHaveProperty('tokenId')
    expect(other.body).toEqual([])
    expect(rejected.body).toEqual([])
    expect(invalid.status).toBe(400)
  })

  it('answers the review detail with sieb facts and the current decisions', async () => {
    const { app, finding, id } = await appWithProposal()
    const { status, body } = await requestJson<ProposalDetail>(app, `/api/proposals/${id}`)

    expect(status).toBe(200)
    expect(body).toMatchObject({
      images: [{ imageRef: finding.imageRef, findingId: finding.id, open: true, decision: null }],
      allScopeDecision: null,
      currentDecisionIds: [{ imageRef: finding.imageRef, decisionId: null, updatedAt: null }],
      decisionValues: {
        status: 'not_affected',
        justification: 'vulnerable_code_not_in_execute_path',
      },
    })
    expect(body.proposal).toMatchObject({
      proposedBy: 'dev',
      clientLabel: 'laptop',
      clientKind: 'claude_code_cli',
    })
    expect(body.proposal).not.toHaveProperty('tokenId')
    expect((await requestJson(app, '/api/proposals/999')).status).toBe(404)
  })

  it('changes metrics, stats and the inbox only after accept', async () => {
    const { app, finding, id, lines } = await appWithProposal()
    const before = await observable(app)
    const { app: fresh } = await syncedTestApp()

    expect(before).toEqual(await observable(fresh))

    const conflict = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      expectedDecisionIds: [
        { imageRef: finding.imageRef, decisionId: 42, updatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const accepted = await requestJson<ProposalAcceptResponse>(
      app,
      `/api/proposals/${id}/accept`,
      'POST',
      {
        expectedDecisionIds: [{ imageRef: finding.imageRef, decisionId: null, updatedAt: null }],
        edits: { reason: 'Reviewed, parser unused' },
      },
    )

    expect(conflict).toEqual({
      status: 409,
      body: {
        error: 'proposal_conflict',
        currentDecisionIds: [{ imageRef: finding.imageRef, decisionId: null, updatedAt: null }],
      },
    })
    expect(accepted.status).toBe(200)
    expect(accepted.body).toMatchObject({
      proposal: { state: 'accepted', resolution: 'accepted_edited', resolvedBy: 'dev' },
      decisions: [
        {
          decision: { status: 'not_affected', reason: 'Reviewed, parser unused' },
          effective: { state: 'active' },
        },
      ],
    })
    expect(accepted.body.proposal).not.toHaveProperty('tokenId')
    expect(await observable(app)).not.toEqual(before)
    expect(await suppressedSeries(app)).toContain(
      `sieb_suppressed{vuln_id="${finding.vulnId}",image_ref="${finding.imageRef}"} 1`,
    )
    expect(lines.some((line) => line.startsWith(`[sieb] proposal ${id} accepted by dev`))).toBe(
      true,
    )

    const again = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      expectedDecisionIds: [{ imageRef: finding.imageRef, decisionId: null, updatedAt: null }],
    })

    expect(again).toEqual({ status: 409, body: { error: 'proposal_closed', state: 'accepted' } })
  })

  it('validates the accept body', async () => {
    const { app, id } = await appWithProposal()
    const { status, body } = await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
      edits: { scope: 'all', status: 'maybe' },
    })

    expect(status).toBe(400)
    expect(body).toEqual({
      error: 'validation',
      errors: [
        { field: 'expectedDecisionIds', code: 'required' },
        { field: 'edits.scope', code: 'not_allowed' },
        { field: 'edits.status', code: 'invalid' },
      ],
    })

    for (const entry of [
      { imageRef: 'x', decisionId: 3 },
      { imageRef: 'x', decisionId: 3, updatedAt: 'yesterday' },
      { imageRef: 'x', decisionId: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    ]) {
      expect(
        (
          await requestJson(app, `/api/proposals/${id}/accept`, 'POST', {
            expectedDecisionIds: [entry],
          })
        ).body,
      ).toEqual({
        error: 'validation',
        errors: [{ field: 'expectedDecisionIds', code: 'invalid' }],
      })
    }
  })

  it('rejects with a required reason and logs it', async () => {
    const { app, id, lines } = await appWithProposal()
    const missing = await requestJson(app, `/api/proposals/${id}/reject`, 'POST', { reason: ' ' })
    const tooLong = await requestJson(app, `/api/proposals/${id}/reject`, 'POST', {
      reason: 'x'.repeat(2001),
    })
    const rejected = await requestJson<ProposalRejectResponse>(
      app,
      `/api/proposals/${id}/reject`,
      'POST',
      { reason: 'Advisory only' },
    )

    expect(missing.body).toEqual({
      error: 'validation',
      errors: [{ field: 'reason', code: 'required' }],
    })
    expect(tooLong.body).toEqual({
      error: 'validation',
      errors: [{ field: 'reason', code: 'too_long' }],
    })
    expect(rejected).toMatchObject({
      status: 200,
      body: { proposal: { state: 'rejected', resolutionNote: 'Advisory only', resolvedBy: 'dev' } },
    })
    expect(rejected.body.proposal).not.toHaveProperty('tokenId')
    expect(lines).toContain(
      `[sieb] proposal ${id} rejected by dev for ${rejected.body.proposal.vulnId} (1 image(s))`,
    )
  })

  it('answers the source access in the finding detail', async () => {
    const { app, finding } = await appWithProposal()

    expect(
      (await requestJson<{ sourceAccess: string }>(app, `/api/findings/${finding.id}`)).body
        .sourceAccess,
    ).toMatch(/^(public|private|unknown)$/)
  })
})
