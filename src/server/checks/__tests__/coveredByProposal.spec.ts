// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CheckCreateResponse } from '#core/check.ts'
import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import {
  checkFixture,
  insertTokenProposal,
  NGINX,
  PUBLIC_URL,
  REDIS,
} from '#server/checks/__tests__/checkFixtures.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'

const USER = { 'X-authentik-username': 'alice' }

/**
 * Creates the main app with Auto-check on and a helper that files a proposal with related findings.
 * @returns {object} - Fixture, app, queue and propose helpers
 */
const setup = () => {
  const fixture = checkFixture()
  const app = createApp(
    testAppDeps({
      db: fixture.db,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
    }),
  )

  /**
   * Files an open proposal on an image that lists related findings.
   * @param {string} imageRef - Target image
   * @param {number[]} related - Related finding ids
   * @param {string} proposedBy - Proposer, one open proposal per target and proposer
   * @returns {number} - Proposal id
   */
  const propose = (imageRef: string, related: number[], proposedBy = 'alice'): number => {
    const id = insertTokenProposal(fixture.db, { tokenId: 1, proposedBy, imageRef })

    fixture.db
      .prepare(
        'UPDATE decision_proposals SET related_findings = ?, related_reason = ? WHERE id = ?',
      )
      .run(
        JSON.stringify(related.map((findingId) => ({ findingId, note: null }))),
        'Same cause.',
        id,
      )

    return id
  }

  /**
   * Queues checks through POST /api/checks.
   * @param {Record<string, unknown>} body - Request body
   * @returns {Promise<{ status: number; body: CheckCreateResponse }>} - Answer
   */
  const queue = (body: Record<string, unknown>) =>
    requestJson<CheckCreateResponse>(app, '/api/checks', 'POST', body, USER)

  return { ...fixture, app, propose, queue }
}

describe('covered_by_proposal', () => {
  it('skips a finding an open proposal lists as related, naming the newest, not its target', async () => {
    const { findings, propose, queue } = setup()

    propose(NGINX, [findings.redis])
    const newest = propose(NGINX, [findings.redis], 'bob')
    const { body } = await queue({ findingIds: [findings.redis, findings.nginx] })

    expect(body.skipped).toEqual([
      { findingId: findings.redis, reason: 'covered_by_proposal', proposalId: newest },
    ])
    expect(body.queued.map((check) => check.findingId)).toEqual([findings.nginx])
  })

  it('queues a covered finding anyway with force', async () => {
    const { findings, propose, queue } = setup()

    propose(NGINX, [findings.redis])

    const { body } = await queue({ findingIds: [findings.redis], force: true })

    expect(body.queued.map((check) => check.findingId)).toEqual([findings.redis])
    expect(body.skipped).toEqual([])
  })

  it('ignores proposals that are no longer open', async () => {
    const { db, findings, propose, queue } = setup()
    const id = propose(NGINX, [findings.redis])

    db.prepare(
      `UPDATE decision_proposals SET state = 'rejected', resolution = 'rejected',
         resolution_note = 'Advisory only', resolved_at = 't', resolved_by = 'dev'
       WHERE id = ?`,
    ).run(id)

    expect((await queue({ findingIds: [findings.redis] })).body.queued).toHaveLength(1)
  })

  it('validates force', async () => {
    const { findings, queue } = setup()

    expect(await queue({ findingIds: [findings.redis], force: 'yes' })).toMatchObject({
      status: 400,
      body: { errors: [{ field: 'force', code: 'invalid' }] },
    })
  })

  it('answers coveredByProposal in the finding list and the detail', async () => {
    const { app, findings, propose } = setup()
    const id = propose(REDIS, [findings.nginx])
    const list = await requestJson<FindingView[]>(app, '/api/findings')
    const byId = new Map(list.body.map((finding) => [finding.id, finding]))
    const detail = await requestJson<FindingDetailResponse>(app, `/api/findings/${findings.nginx}`)

    expect(byId.get(findings.nginx)?.coveredByProposal).toBe(id)
    expect(byId.get(findings.redis)?.coveredByProposal).toBeNull()
    expect(detail.body.finding.coveredByProposal).toBe(id)
  })
})
