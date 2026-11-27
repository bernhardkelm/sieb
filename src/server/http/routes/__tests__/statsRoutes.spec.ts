import { HOUR_MS } from '#core/timeUnits.ts'
// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { ValidationErrorBody } from '#core/errorApiTypes.ts'
import type { StatsResponse } from '#core/statsApiTypes.ts'
import type { FindingView } from '#core/findingView.ts'
import { emptyOverviewStats } from '#core/overviewStats.ts'
import { insertStatsSnapshot } from '#server/db/statsSnapshotRepository.ts'

import { requestJson, syncedTestApp, TEST_NOW } from '#server/http/__tests__/appFixtures.ts'

describe('stats routes', () => {
  it('answers the live stats and the snapshot of the sync', async () => {
    const { app } = await syncedTestApp()
    const findings = (await requestJson<FindingView[]>(app, '/api/findings')).body
    const { status, body } = await requestJson<StatsResponse>(app, '/api/stats')

    expect(status).toBe(200)
    expect(body.current.open).toBe(findings.length)
    expect(body.current.inbox).toBe(findings.filter((finding) => finding.inInbox).length)
    expect(body.current.kev).toBe(findings.filter((finding) => finding.kev).length)
    expect(body.series).toEqual([{ at: TEST_NOW.toISOString(), stats: body.current }])
  })

  it('limits the series to the range and at most 60 points, oldest first', async () => {
    const { app, deps } = await syncedTestApp()

    for (let hours = 1; hours <= 24 * 100; hours += 1) {
      insertStatsSnapshot(
        deps.db,
        {
          at: new Date(TEST_NOW.getTime() - hours * HOUR_MS).toISOString(),
          stats: { ...emptyOverviewStats(), open: hours },
        },
        null,
      )
    }

    const week = (await requestJson<StatsResponse>(app, '/api/stats?range=7d')).body.series
    const quarter = (await requestJson<StatsResponse>(app, '/api/stats?range=90d')).body.series
    const times = quarter.map((point) => point.at)

    expect(week.length).toBeLessThanOrEqual(60)
    expect(week[0]?.stats.open).toBeLessThanOrEqual(24 * 7)
    expect(week.at(-1)?.at).toBe(TEST_NOW.toISOString())
    expect(quarter.length).toBe(60)
    expect(times).toEqual([...times].sort())
    expect(quarter[0]?.stats.open).toBeLessThanOrEqual(24 * 90)
  })

  it('rejects an unknown range', async () => {
    const { app } = await syncedTestApp()
    const { status, body } = await requestJson<ValidationErrorBody>(app, '/api/stats?range=1y')

    expect(status).toBe(400)
    expect(body.errors).toEqual([{ field: 'range', code: 'invalid' }])
  })
})
