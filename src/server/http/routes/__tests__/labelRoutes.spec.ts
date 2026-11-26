// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { LabelsResponse, StatsResponse } from '#core/apiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { buildSnapshot } from '#server/db/__tests__/dbFixtures.ts'
import { createApp } from '#server/http/createApp.ts'
import { applySnapshot } from '#server/sync/applySnapshot.ts'

import {
  requestJson,
  syncedTestApp,
  testAppDeps,
  TEST_NOW,
} from '#server/http/__tests__/appFixtures.ts'

describe('label routes', () => {
  it('answers the exposure presence and owners of the mock data', async () => {
    const { app } = await syncedTestApp()
    const { status, body } = await requestJson<LabelsResponse>(app, '/api/labels')

    expect(status).toBe(200)
    expect(body).toEqual({
      exposure: true,
      owners: ['self', 'platform', 'third-party'],
      kev: 'cisa',
    })
  })

  it('reports no labels for findings without exposure and owner', async () => {
    const deps = testAppDeps()

    applySnapshot(
      deps.db,
      buildSnapshot([
        { exposure: null, owner: null },
        { vulnId: 'CVE-2025-2000', exposure: null, owner: null },
      ]),
      TEST_NOW,
    )

    const app = createApp(deps)
    const labels = (await requestJson<LabelsResponse>(app, '/api/labels')).body
    const findings = (await requestJson<FindingView[]>(app, '/api/findings')).body
    const stats = (await requestJson<StatsResponse>(app, '/api/stats')).body

    expect(labels).toEqual({ exposure: false, owners: [], kev: 'cisa' })
    expect(findings.map((finding) => [finding.exposure, finding.owner])).toEqual([
      [null, null],
      [null, null],
    ])
    expect(stats.current).toMatchObject({ open: 2, public: 0 })
  })

  it('reports only the labels some open findings carry', async () => {
    const deps = testAppDeps()

    applySnapshot(
      deps.db,
      buildSnapshot([
        { exposure: null, owner: 'team-b' },
        { vulnId: 'CVE-2025-2000', exposure: 'public', owner: null },
        { vulnId: 'CVE-2025-3000', exposure: null, owner: 'self' },
      ]),
      TEST_NOW,
    )

    const labels = (await requestJson<LabelsResponse>(createApp(deps), '/api/labels')).body

    expect(labels).toEqual({ exposure: true, owners: ['self', 'team-b'], kev: 'cisa' })
  })

  it.each(['cisa', 'prometheus', 'none'] as const)(
    'answers the KEV source %s',
    async (kevSource) => {
      const labels = (
        await requestJson<LabelsResponse>(createApp(testAppDeps({ kevSource })), '/api/labels')
      ).body

      expect(labels.kev).toBe(kevSource)
    },
  )
})
