// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { InboxResponse, InboxSeenResponse, ValidationErrorBody } from '#core/apiTypes.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { readSeenMarks } from '#server/db/inboxRepository.ts'
import { insertProposal, resolveProposal } from '#server/db/proposalRepository.ts'
import { createApp, type AppDeps } from '#server/http/createApp.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import { buildSnapshot, NGINX, REDIS } from '#server/db/__tests__/dbFixtures.ts'
import { requestJson, TEST_NOW, testAppDeps } from '#server/http/__tests__/appFixtures.ts'

const ALICE = { 'X-authentik-username': 'alice' }
const BOB = { 'X-authentik-username': 'bob' }
const DAY_MS = 24 * 60 * 60 * 1000
const EXPIRES_AT = new Date(TEST_NOW.getTime() + 3 * DAY_MS).toISOString()
const KEV_SINCE = new Date(TEST_NOW.getTime() - DAY_MS).toISOString()

/**
 * Creates an app without a dev user over a KEV listed nginx finding of CVE-2025-1000 first seen
 * by a sync a day ago and an accepted redis decision of CVE-2025-2000 expiring in three days.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {ReturnType<typeof createApp>} - App
 */
const inboxApp = (overrides: Partial<AppDeps> = {}): ReturnType<typeof createApp> =>
  createApp(seededDeps(overrides))

/**
 * Builds the dependencies of inboxApp over the seeded database.
 * @param {Partial<AppDeps>} overrides - Dependencies to replace
 * @returns {AppDeps} - Dependencies
 */
const seededDeps = (overrides: Partial<AppDeps> = {}): AppDeps => {
  const deps = testAppDeps({ devUser: null, ...overrides })

  applySnapshot(
    deps.db,
    buildSnapshot(
      [{ imageRef: NGINX }, { imageRef: REDIS, vulnId: 'CVE-2025-2000', resourceName: 'cache-0' }],
      ['CVE-2025-1000'],
    ),
    new Date(KEV_SINCE),
    { initialImport: false },
  )
  createDecision(
    deps.db,
    {
      vulnId: 'CVE-2025-2000',
      scope: 'image',
      imageRef: REDIS,
      status: 'accepted',
      justification: null,
      reason: 'internal only',
      expiresAt: EXPIRES_AT,
      upstreamPending: false,
      waitingFor: null,
    },
    'alice',
    TEST_NOW,
  )

  return deps
}

/**
 * Reads the Inbox keys of a user.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {Record<string, string>} user - Identity header
 * @returns {Promise<string[]>} - Item keys
 */
const keysOf = async (
  app: ReturnType<typeof createApp>,
  user: Record<string, string>,
): Promise<string[]> =>
  (await requestJson<InboxResponse>(app, '/api/inbox', 'GET', undefined, user)).body.items.map(
    (item) => item.key,
  )

describe('inbox routes', () => {
  it('needs an identity for reading and marking', async () => {
    const app = inboxApp()

    expect((await requestJson(app, '/api/inbox')).status).toBe(401)
    expect((await requestJson(app, '/api/inbox/seen', 'POST', { keys: ['kev:1'] })).status).toBe(
      401,
    )
  })

  it('lists the items with links from the request origin or SIEB_PUBLIC_URL', async () => {
    const response = await inboxApp().request('/api/inbox', { headers: ALICE })
    const { items, counts } = (await response.json()) as InboxResponse

    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(counts).toEqual({ proposal: 0, reopened: 0, expiring: 1, kev: 1, total: 2 })
    expect(items).toEqual([
      expect.objectContaining({
        kind: 'kev',
        key: 'kev:1',
        at: KEV_SINCE,
        url: 'http://localhost/triage?finding=1',
        refs: { findingId: 1, decisionId: null },
        decisionStatus: null,
      }),
      expect.objectContaining({
        kind: 'expiring',
        key: `expiring:1:${EXPIRES_AT}`,
        at: EXPIRES_AT,
        vulnId: 'CVE-2025-2000',
        imageRef: REDIS,
        url: 'http://localhost/triage?finding=2',
        refs: { decisionId: 1, findingId: 2 },
        decisionStatus: 'accepted',
      }),
    ])

    const configured = await requestJson<InboxResponse>(
      inboxApp({ publicUrl: 'https://sieb.example.com' }),
      '/api/inbox',
      'GET',
      undefined,
      ALICE,
    )

    expect(configured.body.items[0]?.url).toBe('https://sieb.example.com/triage?finding=1')
  })

  it('marks items seen per user, idempotently, and answers the new counts', async () => {
    const app = inboxApp()
    const keys = ['kev:1', `expiring:1:${EXPIRES_AT}`]
    const first = await requestJson<InboxSeenResponse>(
      app,
      '/api/inbox/seen',
      'POST',
      { keys },
      ALICE,
    )
    const again = await requestJson<InboxSeenResponse>(
      app,
      '/api/inbox/seen',
      'POST',
      { keys },
      ALICE,
    )

    const counts = { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: 0 }

    expect(first).toEqual({ status: 200, body: { counts, ignored: [] } })
    expect(again).toEqual({ status: 200, body: { counts, ignored: keys } })
    expect(await keysOf(app, ALICE)).toEqual([])
    expect(await keysOf(app, BOB)).toEqual(keys)
  })

  it('marks only keys listed in the Inbox of the user and answers the others as ignored', async () => {
    const deps = seededDeps()
    const app = createApp(deps)
    const unknown = ['kev:99', 'expiring:1:2020-01-01T00:00:00.000Z']
    const { body } = await requestJson<InboxSeenResponse>(
      app,
      '/api/inbox/seen',
      'POST',
      { keys: ['kev:1', ...unknown] },
      ALICE,
    )

    expect(body).toEqual({
      counts: { proposal: 0, reopened: 0, expiring: 1, kev: 0, total: 1 },
      ignored: unknown,
    })
    expect([...readSeenMarks(deps.db, 'alice').keys()]).toEqual(['kev:1'])
  })

  it('rejects bodies that are no key list, too long, or name items that cannot be seen', async () => {
    const app = inboxApp()
    /**
     * Posts a body and returns the answer.
     * @param {unknown} body - Request body
     * @returns {Promise<{ status: number; body: ValidationErrorBody }>} - Answer
     */
    const post = (body: unknown) =>
      requestJson<ValidationErrorBody>(app, '/api/inbox/seen', 'POST', body, ALICE)

    expect(await post(['kev:1'])).toEqual({
      status: 400,
      body: { error: 'validation', errors: [{ field: null, code: 'invalid_body' }] },
    })
    expect(
      (await post({ keys: Array.from({ length: 201 }, (_, i) => `kev:${i + 1}`) })).body,
    ).toEqual({ error: 'validation', errors: [{ field: 'keys', code: 'too_many' }] })
    expect((await post({ keys: ['kev:1', 'proposal:1', 'kev:-1'] })).body.errors).toEqual([
      { field: 'keys.1', code: 'not_seeable' },
      { field: 'keys.2', code: 'invalid' },
    ])
    expect(await keysOf(app, ALICE)).toHaveLength(2)
  })

  it('lists open proposals with their review link, resolved ones leave', async () => {
    const deps = seededDeps()
    /**
     * Files an open proposal on nginx.
     * @param {string} createdAt - Filing time
     * @returns {number} - Proposal id
     */
    const file = (createdAt: string): number =>
      insertProposal(deps.db, {
        ...buildProposalInput(),
        ...PROPOSER,
        sourceAccess: [],
        basisDecisions: [{ imageRef: NGINX, decisionId: null, updatedAt: null }],
        createdAt,
      })
    const resolved = file(KEV_SINCE)

    resolveProposal(deps.db, resolved, {
      state: 'rejected',
      resolution: 'rejected',
      note: 'no',
      decisionIds: [],
      at: TEST_NOW.toISOString(),
      by: 'alice',
    })
    const open = file(TEST_NOW.toISOString())
    const { body } = await requestJson<InboxResponse>(
      createApp(deps),
      '/api/inbox',
      'GET',
      undefined,
      ALICE,
    )

    expect(body.counts.proposal).toBe(1)
    expect(body.items[0]).toEqual({
      kind: 'proposal',
      key: `proposal:${open}`,
      at: TEST_NOW.toISOString(),
      vulnId: 'CVE-2025-1000',
      imageRef: NGINX,
      severity: 'High',
      kev: true,
      title: null,
      url: `http://localhost/inbox/proposals/${open}`,
      refs: { proposalId: open },
      imageRefs: [NGINX],
      verdict: 'not_affected',
      confidence: 'medium',
      patchAction: null,
      upstreamPending: false,
      clientKind: 'claude_code_cli',
      clientLabel: 'laptop',
      agent: null,
      imageCount: 1,
      currentDecisionIds: [{ imageRef: NGINX, decisionId: null, updatedAt: null }],
      outdated: false,
    })
  })
})
