// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { CheckCreateResponse } from '#core/check.ts'
import type { PullProbeResult } from '#core/imageVisibility.ts'
import { checkFixture, OWN, PUBLIC_URL, START } from '#server/checks/__tests__/checkFixtures.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { fakePullProber } from '#server/visibility/__tests__/fakePullProber.ts'
import { storePullProbe } from '#server/visibility/pullProbeRepository.ts'

const USER = { 'X-authentik-username': 'alice' }

/**
 * Creates the main app with Auto-check on and an optional fake pull prober.
 * @param {PullProbeResult | null | undefined} probe - Result the prober stores, null for a timeout, undefined for no prober
 * @returns {object} - Fixture, app and the prober calls
 */
const setup = (probe?: PullProbeResult | null) => {
  const fake = probe === undefined ? null : fakePullProber(probe)
  const fixture = checkFixture({ pullProber: fake?.prober ?? null })

  fake?.attach(fixture.db)

  const app = createApp(
    testAppDeps({
      db: fixture.db,
      mcpEnabled: true,
      publicUrl: PUBLIC_URL,
      checks: fixture.context,
    }),
  )

  /**
   * Queues checks through POST /api/checks.
   * @param {number[]} findingIds - Findings
   * @returns {Promise<CheckCreateResponse>} - Answer
   */
  const queue = async (findingIds: number[]): Promise<CheckCreateResponse> =>
    (await requestJson<CheckCreateResponse>(app, '/api/checks', 'POST', { findingIds }, USER)).body

  return { ...fixture, app, queue, calls: fake?.calls ?? [] }
}

describe('Auto-check eligibility by image visibility', () => {
  it('queues an own image the stored probe saw public, without a credential', async () => {
    const { db, findings, queue } = setup()

    storePullProbe(db, OWN, { result: 'public', reason: null }, START)

    expect((await queue([findings.own])).queued.map((check) => check.findingId)).toEqual([
      findings.own,
    ])
  })

  it('skips an own image the probe saw restricted as not_public', async () => {
    const { db, findings, queue } = setup()

    storePullProbe(db, OWN, { result: 'restricted', reason: '401 unauthorized' }, START)

    expect((await queue([findings.own])).skipped).toEqual([
      { findingId: findings.own, reason: 'not_public' },
    ])
  })

  it('skips an own image never probed as visibility_unknown', async () => {
    const { findings, queue } = setup()

    expect((await queue([findings.own])).skipped).toEqual([
      { findingId: findings.own, reason: 'visibility_unknown' },
    ])
  })

  it('probes an own image before deciding and queues it once the probe saw it public', async () => {
    const { findings, queue, calls } = setup('public')

    expect((await queue([findings.own])).queued).toHaveLength(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.images).toContainEqual(expect.objectContaining({ imageRef: OWN }))
    expect(calls[0]?.waitMs).toBeGreaterThan(0)
  })

  it('skips an own image as visibility_unknown when the probe does not answer in time', async () => {
    const { findings, queue } = setup(null)

    expect((await queue([findings.own])).skipped).toEqual([
      { findingId: findings.own, reason: 'visibility_unknown' },
    ])
  })

  it('queues a third-party image on a public registry without a probe', async () => {
    const { db, findings, queue } = setup('restricted')
    const result = await queue([findings.nginx])

    expect(result.queued.map((check) => check.findingId)).toEqual([findings.nginx])
    expect(db.prepare('SELECT COUNT(*) AS n FROM image_pull_probes').get()?.n).toBe(0)
  })
})
