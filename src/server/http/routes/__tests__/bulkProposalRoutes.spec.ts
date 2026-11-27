// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Hono } from 'hono'

import type { InboxResponse } from '#core/inboxApiTypes.ts'
import type { ProposalListItem } from '#core/proposalApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import type { ProposalInboxItem } from '#core/inbox/inboxItem.ts'
import { MAX_BULK_PROPOSALS, type BulkProposalResponse } from '#core/proposalBulk.ts'
import type { ProposalInput } from '#core/proposalRecord.ts'
import { DEFAULT_PUBLIC_REGISTRIES } from '#core/sourceAccess.ts'
import { createProposal } from '#server/db/createProposal.ts'
import type { AppEnv } from '#server/http/AppEnv.ts'
import type { AppDeps } from '#server/http/createApp.ts'

import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { requestJson, syncedTestApp, TEST_NOW } from '#server/http/__tests__/appFixtures.ts'

const ALICE = { 'X-authentik-username': 'alice' }

interface Fixture {
  app: Hono<AppEnv>
  deps: AppDeps
  findings: FindingView[]
  lines: string[]
}

/**
 * Starts a synced app and picks inbox findings of distinct vulnerabilities, so proposals on
 * them never supersede each other.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {Promise<Fixture>} - App, dependencies, findings and log lines
 */
const fixture = async (overrides: Partial<AppDeps> = {}): Promise<Fixture> => {
  const lines: string[] = []
  const { app, deps } = await syncedTestApp({ log: (line) => lines.push(line), ...overrides })
  const inbox = (
    await requestJson<FindingView[]>(app, '/api/findings?view=inbox', 'GET', undefined, ALICE)
  ).body
  const findings = inbox.filter(
    (finding, index) => inbox.findIndex((other) => other.vulnId === finding.vulnId) === index,
  )

  if (findings.length < 5) {
    throw new Error('fixtures lack five vulnerabilities to triage')
  }

  return { app, deps, findings, lines }
}

/**
 * Files a proposal on a finding.
 * @param {AppDeps} deps - Dependencies
 * @param {FindingView} finding - Target finding
 * @param {Partial<ProposalInput>} overrides - Proposal fields to set
 * @returns {number} - Proposal id
 */
const propose = (
  deps: AppDeps,
  finding: FindingView,
  overrides: Partial<ProposalInput> = {},
): number => {
  const result = createProposal(
    deps.db,
    buildProposalInput({ vulnId: finding.vulnId, imageRefs: [finding.imageRef], ...overrides }),
    { proposer: PROPOSER, publicRegistries: DEFAULT_PUBLIC_REGISTRIES, now: TEST_NOW },
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result.proposal.id
}

/**
 * Reads the proposal items of the Inbox by proposal id.
 * @param {Hono<AppEnv>} app - App
 * @param {Record<string, string>} user - Identity header
 * @returns {Promise<Map<number, ProposalInboxItem>>} - Items per proposal id
 */
const proposalItems = async (
  app: Hono<AppEnv>,
  user: Record<string, string> = ALICE,
): Promise<Map<number, ProposalInboxItem>> => {
  const { body } = await requestJson<InboxResponse>(app, '/api/inbox', 'GET', undefined, user)

  return new Map(
    body.items
      .filter((item): item is ProposalInboxItem => item.kind === 'proposal')
      .map((item) => [item.refs.proposalId, item]),
  )
}

/**
 * Builds a bulk accept entry from the Inbox item of a proposal.
 * @param {Map<number, ProposalInboxItem>} items - Inbox items per proposal id
 * @param {number} id - Proposal id
 * @returns {{ id: number; expectedDecisionIds: unknown }} - Entry
 */
const entryOf = (
  items: Map<number, ProposalInboxItem>,
  id: number,
): { id: number; expectedDecisionIds: unknown } => ({
  id,
  expectedDecisionIds: items.get(id)?.currentDecisionIds,
})

/**
 * Lists the proposals in a state.
 * @param {Hono<AppEnv>} app - App
 * @param {string} state - Proposal state
 * @returns {Promise<ProposalListItem[]>} - Proposals
 */
const proposalsIn = async (app: Hono<AppEnv>, state: string): Promise<ProposalListItem[]> =>
  (await requestJson<ProposalListItem[]>(app, `/api/proposals?state=${state}`)).body

describe('bulk proposal routes', () => {
  it('accepts fresh proposals one by one and skips the others with their outcome', async () => {
    const { app, deps, findings, lines } = await fixture()
    const [fresh, outdated, inconclusive, stale, closed] = findings as [
      FindingView,
      FindingView,
      FindingView,
      FindingView,
      FindingView,
    ]
    const ids = {
      fresh: propose(deps, fresh),
      outdated: propose(deps, outdated),
      inconclusive: propose(deps, inconclusive, {
        verdict: 'inconclusive',
        justification: null,
        missing: ['pull access to the registry'],
      }),
      stale: propose(deps, stale),
      closed: propose(deps, closed),
    }

    await requestJson(app, `/api/proposals/${ids.closed}/reject`, 'POST', { reason: 'no' }, ALICE)
    await requestJson(
      app,
      '/api/decisions',
      'POST',
      {
        vulnId: outdated.vulnId,
        scope: 'image',
        imageRef: outdated.imageRef,
        status: 'fix_planned',
        reason: 'patch first',
      },
      ALICE,
    )

    const items = await proposalItems(app)

    expect(items.get(ids.outdated)?.outdated).toBe(true)
    expect(items.get(ids.fresh)).toMatchObject({
      outdated: false,
      currentDecisionIds: [{ imageRef: fresh.imageRef, decisionId: null, updatedAt: null }],
    })

    const response = await requestJson<BulkProposalResponse>(
      app,
      '/api/proposals/bulk-accept',
      'POST',
      {
        items: [
          entryOf(items, ids.fresh),
          { id: ids.outdated, expectedDecisionIds: items.get(ids.outdated)?.currentDecisionIds },
          entryOf(items, ids.inconclusive),
          {
            id: ids.stale,
            expectedDecisionIds: [
              { imageRef: stale.imageRef, decisionId: 42, updatedAt: '2026-01-01T00:00:00.000Z' },
            ],
          },
          {
            id: ids.closed,
            expectedDecisionIds: [{ imageRef: null, decisionId: null, updatedAt: null }],
          },
          {
            id: 9999,
            expectedDecisionIds: [{ imageRef: null, decisionId: null, updatedAt: null }],
          },
        ],
      },
      ALICE,
    )

    expect(response).toEqual({
      status: 200,
      body: {
        results: [
          { id: ids.fresh, vulnId: fresh.vulnId, outcome: 'accepted' },
          { id: ids.outdated, vulnId: outdated.vulnId, outcome: 'outdated' },
          { id: ids.inconclusive, vulnId: inconclusive.vulnId, outcome: 'inconclusive' },
          { id: ids.stale, vulnId: stale.vulnId, outcome: 'outdated' },
          { id: ids.closed, vulnId: closed.vulnId, outcome: 'not_open' },
          { id: 9999, vulnId: null, outcome: 'not_found' },
        ],
      },
    })
    expect((await proposalsIn(app, 'accepted')).map((item) => item.proposal)).toEqual([
      expect.objectContaining({ id: ids.fresh, resolution: 'accepted', resolvedBy: 'alice' }),
    ])
    expect([...(await proposalItems(app)).keys()].sort()).toEqual(
      [ids.outdated, ids.inconclusive, ids.stale].sort(),
    )
    expect(lines.filter((line) => line.includes('accepted by alice'))).toHaveLength(1)
  })

  it('rejects open proposals with one reason and reports closed and unknown ones', async () => {
    const { app, deps, findings, lines } = await fixture()
    const [first, second, third] = findings as [FindingView, FindingView, FindingView]
    const ids = [propose(deps, first), propose(deps, second), propose(deps, third)]

    await requestJson(app, `/api/proposals/${ids[2]}/reject`, 'POST', { reason: 'no' }, ALICE)

    const response = await requestJson<BulkProposalResponse>(
      app,
      '/api/proposals/bulk-reject',
      'POST',
      { ids: [...ids, 9999], reason: 'Parser reachable through the upload endpoint' },
      ALICE,
    )

    expect(response.body.results).toEqual([
      { id: ids[0], vulnId: first.vulnId, outcome: 'rejected' },
      { id: ids[1], vulnId: second.vulnId, outcome: 'rejected' },
      { id: ids[2], vulnId: third.vulnId, outcome: 'not_open' },
      { id: 9999, vulnId: null, outcome: 'not_found' },
    ])
    expect(
      (await proposalsIn(app, 'rejected'))
        .filter((item) => item.proposal.id !== ids[2])
        .map((item) => item.proposal.resolutionNote),
    ).toEqual([
      'Parser reachable through the upload endpoint',
      'Parser reachable through the upload endpoint',
    ])
    expect(lines.filter((line) => line.includes('rejected by alice'))).toHaveLength(3)
  })

  it('validates the bodies and caps the batch', async () => {
    const { app } = await fixture()
    const entry = {
      id: 1,
      expectedDecisionIds: [{ imageRef: null, decisionId: null, updatedAt: null }],
    }
    const tooMany = Array.from({ length: MAX_BULK_PROPOSALS + 1 }, (_, index) => ({
      ...entry,
      id: index + 1,
    }))
    /**
     * Posts a body to a bulk route.
     * @param {string} path - Route below /api/proposals
     * @param {unknown} body - Request body
     * @returns {Promise<{ status: number; body: unknown }>} - Answer
     */
    const post = (path: string, body: unknown): Promise<{ status: number; body: unknown }> =>
      requestJson(app, `/api/proposals/${path}`, 'POST', body, ALICE)

    expect(await post('bulk-accept', { items: tooMany })).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'items', code: 'too_many' }] },
    })
    expect((await post('bulk-accept', { items: [] })).status).toBe(400)
    expect((await post('bulk-accept', { items: [entry, entry] })).body).toEqual({
      error: 'validation',
      errors: [{ field: 'items', code: 'duplicate' }],
    })
    expect((await post('bulk-accept', { items: [{ id: 2 }, { id: 'x' }] })).body).toEqual({
      error: 'validation',
      errors: [
        { field: 'items[0].expectedDecisionIds', code: 'required' },
        { field: 'items[1].id', code: 'invalid' },
      ],
    })
    expect(
      await post('bulk-reject', { ids: tooMany.map((item) => item.id), reason: 'no' }),
    ).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: 'ids', code: 'too_many' }] },
    })
    expect((await post('bulk-reject', { ids: [1, 1], reason: ' ' })).body).toEqual({
      error: 'validation',
      errors: [
        { field: 'reason', code: 'required' },
        { field: 'ids', code: 'duplicate' },
      ],
    })
  })

  it('needs an identity and keeps the CSRF write guard', async () => {
    const { app, deps, findings } = await fixture({ devUser: null })
    const id = propose(deps, findings[0]!)
    const body = { ids: [id], reason: 'no' }
    const anonymous = await requestJson(app, '/api/proposals/bulk-reject', 'POST', body)
    const crossSite = await requestJson(app, '/api/proposals/bulk-reject', 'POST', body, {
      ...ALICE,
      'Sec-Fetch-Site': 'cross-site',
    })
    const plain = await app.request('/api/proposals/bulk-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', ...ALICE },
      body: JSON.stringify({ items: [] }),
    })

    expect(anonymous.status).toBe(401)
    expect(crossSite).toEqual({ status: 403, body: { error: 'cross_site_request' } })
    expect(plain.status).toBe(415)
    expect([...(await proposalItems(app)).keys()]).toEqual([id])
  })
})
