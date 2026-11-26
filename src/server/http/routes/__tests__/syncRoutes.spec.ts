// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { SyncStatusResponse } from '#core/apiTypes.ts'
import type { SyncRun } from '#core/syncRun.ts'

import { recordKevFailure } from '#server/db/kevFeedRepository.ts'

import { requestJson, syncedTestApp } from '#server/http/__tests__/appFixtures.ts'

describe('sync routes', () => {
  it('answers the latest run and runs syncs on demand', async () => {
    const { app } = await syncedTestApp()
    const status = await requestJson<SyncStatusResponse>(app, '/api/sync')

    expect(status.body).toMatchObject({
      run: { id: 1, status: 'success' },
      lastFinished: { id: 1 },
      running: false,
    })

    const second = await requestJson<SyncRun>(app, '/api/sync', 'POST')
    const third = await requestJson<SyncRun>(app, '/api/sync', 'POST')

    expect(second.body).toMatchObject({ id: 2, status: 'success' })
    expect(second.body.counts?.findingsResolved).toBeGreaterThan(0)
    expect(third.body).toMatchObject({ id: 3, status: 'success' })
    expect(third.body.counts?.findingsReappeared).toBeGreaterThan(0)
  })

  it('adds the health of the CISA catalog for the cisa KEV source only', async () => {
    const cisa = await syncedTestApp({ kevSource: 'cisa' })

    recordKevFailure(cisa.deps.db, 'fetch failed', '2026-06-01T11:00:00.000Z')

    expect((await requestJson<SyncStatusResponse>(cisa.app, '/api/sync')).body.kevFeed).toEqual({
      lastAttemptAt: '2026-06-01T11:00:00.000Z',
      lastSuccessAt: null,
      lastError: 'fetch failed',
      catalogVersion: null,
      entryCount: 0,
      stale: true,
    })

    for (const kevSource of ['prometheus', 'none'] as const) {
      const { app } = await syncedTestApp({ kevSource })

      expect((await requestJson<SyncStatusResponse>(app, '/api/sync')).body.kevFeed).toBeNull()
    }
  })
})
