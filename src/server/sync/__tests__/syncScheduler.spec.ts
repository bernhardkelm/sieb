// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncRun } from '#core/syncRun.ts'
import { startSyncScheduler } from '#server/sync/syncScheduler.ts'

describe('startSyncScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncs on start and every interval until stopped', () => {
    const syncNow = vi.fn<() => Promise<SyncRun>>(async () => ({}) as SyncRun)
    const scheduler = startSyncScheduler({ syncNow }, 15)

    expect(syncNow).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(15 * 60_000)
    expect(syncNow).toHaveBeenCalledTimes(2)

    scheduler.stop()
    vi.advanceTimersByTime(60 * 60_000)
    expect(syncNow).toHaveBeenCalledTimes(2)
  })

  it('logs a rejected sync instead of leaving it unhandled', async () => {
    const lines: string[] = []
    const syncNow = vi.fn<() => Promise<SyncRun>>(async () => {
      throw new Error('database is locked')
    })
    const scheduler = startSyncScheduler({ syncNow }, 15, (line) => lines.push(line))

    await vi.waitFor(() => {
      expect(lines).toEqual(['[sieb] scheduled sync failed: database is locked'])
    })
    scheduler.stop()
  })
})
