// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { FindingView } from '#core/findingView.ts'
import { buildProposalInput, PROPOSER } from '#core/__tests__/proposalBuilders.ts'
import {
  checkFixture,
  DIGEST,
  NGINX,
  OTHER,
  OWN,
  REDIS,
  START,
} from '#server/checks/__tests__/checkFixtures.ts'
import { buildSnapshot } from '#server/db/__tests__/dbFixtures.ts'
import { createDecision } from '#server/db/createDecision.ts'
import { insertProposal } from '#server/db/proposalRepository.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

/**
 * Creates the app over the check fixture with a proposal on nginx, a queued check on redis and
 * a re-opened decision on the other image, whose severity rose after the decision.
 * @param {boolean} checksEnabled - Whether Auto-check is on
 * @returns {Promise<ReturnType<typeof createApp>>} - App
 */
const pendingApp = async (checksEnabled = true): Promise<ReturnType<typeof createApp>> => {
  const fixture = checkFixture()
  const deps = testAppDeps({ db: fixture.db, checks: fixture.context })
  const app = createApp(deps)

  insertProposal(fixture.db, {
    ...buildProposalInput(),
    ...PROPOSER,
    imageAccess: [],
    basisDecisions: [],
    createdAt: START.toISOString(),
  })
  await requestJson(app, '/api/checks', 'POST', { findingIds: [fixture.findings.redis] })
  createDecision(
    fixture.db,
    {
      vulnId: 'CVE-2025-1000',
      scope: 'image',
      imageRef: OTHER,
      status: 'accepted',
      justification: null,
      reason: 'internal only',
      expiresAt: null,
      upstreamPending: false,
      waitingFor: null,
    },
    'alice',
    START,
  )
  applySnapshot(
    fixture.db,
    buildSnapshot([
      { imageRef: NGINX, imageDigest: DIGEST },
      { imageRef: REDIS, imageTag: '7.4' },
      { imageRef: OWN, owner: 'self' },
      { imageRef: OTHER, severity: 'Critical' },
    ]),
    START,
  )

  return checksEnabled ? app : createApp({ ...deps, checks: null })
}

/**
 * Lists the images of the open findings a pending filter keeps.
 * @param {ReturnType<typeof createApp>} app - App
 * @param {string} pending - Value of the pending param
 * @returns {Promise<string[]>} - Image refs, sorted
 */
const imagesOf = async (app: ReturnType<typeof createApp>, pending: string): Promise<string[]> => {
  const { body } = await requestJson<FindingView[]>(app, `/api/findings?pending=${pending}`)

  return body.map((finding) => finding.imageRef).sort()
}

describe('GET /api/findings?pending', () => {
  it('filters by proposal, re-open, open check and untouched, several options with OR', async () => {
    const app = await pendingApp()

    expect(await imagesOf(app, 'proposed')).toEqual([NGINX])
    expect(await imagesOf(app, 'reopened')).toEqual([OTHER])
    expect(await imagesOf(app, 'checking')).toEqual([REDIS])
    expect(await imagesOf(app, 'kev')).toEqual([])
    expect(await imagesOf(app, 'untouched')).toEqual([OWN])
    expect(await imagesOf(app, 'proposed,untouched')).toEqual([NGINX, OWN].sort())
  })

  it('ignores checking while Auto-check is off', async () => {
    const app = await pendingApp(false)
    const all = (await requestJson<FindingView[]>(app, '/api/findings')).body

    expect(await imagesOf(app, 'checking')).toHaveLength(all.length)
    expect(await imagesOf(app, 'untouched')).toEqual([OWN, REDIS].sort())
  })

  it('answers 400 for an unknown option', async () => {
    const app = await pendingApp()
    const { status, body } = await requestJson(app, '/api/findings?pending=proposed,later')

    expect(status).toBe(400)
    expect(body).toMatchObject({ errors: [{ field: 'pending', code: 'invalid' }] })
  })
})
