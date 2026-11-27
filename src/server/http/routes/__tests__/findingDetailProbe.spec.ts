// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import type { PullProbeResult } from '#core/imageVisibility.ts'
import { checkFixture, NGINX, OWN } from '#server/checks/__tests__/checkFixtures.ts'
import { requestJson, testAppDeps } from '#server/http/__tests__/appFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { fakePullProber } from '#server/visibility/__tests__/fakePullProber.ts'

/**
 * Creates the main app over the check fixture with a fake pull prober and no Auto-check.
 * @param {PullProbeResult | null} probe - Result the prober stores for own images
 * @returns {object} - Fixture, app and the prober calls
 */
const setup = (probe: PullProbeResult | null) => {
  const fake = fakePullProber(probe)
  const fixture = checkFixture()

  fake.attach(fixture.db)

  const app = createApp(testAppDeps({ db: fixture.db, pullProber: fake.prober }))

  return { ...fixture, app, calls: fake.calls }
}

describe('GET /api/findings/:id visibility', () => {
  it('probes an own image, waits up to 1.5 seconds and answers the probed visibility', async () => {
    const { app, findings, calls } = setup('public')
    const { body } = await requestJson<FindingDetailResponse>(app, `/api/findings/${findings.own}`)

    expect(calls).toEqual([{ images: [expect.objectContaining({ imageRef: OWN })], waitMs: 1500 }])
    expect(body).toMatchObject({ imageVisibility: 'public', ownership: 'own' })
    expect(body.checkAccess).toEqual([
      { imageRef: OWN, level: 'public', credentialId: null, credentialLabel: null },
    ])
  })

  it('answers unknown for an own image the probe did not answer for', async () => {
    const { app, findings } = setup(null)
    const { body } = await requestJson<FindingDetailResponse>(app, `/api/findings/${findings.own}`)

    expect(body).toMatchObject({ imageVisibility: 'unknown', ownership: 'own' })
  })

  it('passes a third-party image to the prober, which probes own images only', async () => {
    const { app, db, findings, calls } = setup('restricted')
    const { body } = await requestJson<FindingDetailResponse>(
      app,
      `/api/findings/${findings.nginx}`,
    )

    expect(body).toMatchObject({ imageVisibility: 'public', ownership: 'third_party' })
    expect(calls[0]?.images).toEqual([
      expect.objectContaining({ imageRef: NGINX, owner: 'third-party' }),
    ])
    expect(db.prepare('SELECT COUNT(*) AS n FROM image_pull_probes').get()?.n).toBe(0)
  })
})
