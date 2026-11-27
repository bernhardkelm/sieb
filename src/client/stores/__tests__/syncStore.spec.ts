import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncStatusResponse } from '#core/syncApiTypes.ts'
import type { SyncRun } from '#core/syncRun.ts'
import { fetchSyncStatus, triggerSync } from '@/api/syncApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useSyncStore } from '@/stores/syncStore'

vi.mock('@/api/syncApi', () => ({
  fetchSyncStatus: vi.fn<() => Promise<SyncStatusResponse>>(),
  triggerSync: vi.fn<() => Promise<SyncRun>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
}))

/**
 * Builds a finished sync run.
 * @param {number} id - Run id
 * @param {Partial<SyncRun>} overrides - Fields to set
 * @returns {SyncRun} - Run
 */
const run = (id: number, overrides: Partial<SyncRun> = {}): SyncRun => ({
  id,
  source: 'mock',
  status: 'success',
  startedAt: '2026-06-01T12:00:00.000Z',
  finishedAt: '2026-06-01T12:00:05.000Z',
  fetchedAt: '2026-06-01T12:00:04.000Z',
  error: null,
  counts: null,
  ...overrides,
})

/**
 * Builds a status answer with a finished run.
 * @param {SyncRun | null} lastFinished - Latest finished run
 * @param {boolean} running - Whether a run is in progress
 * @returns {SyncStatusResponse} - Status
 */
const status = (lastFinished: SyncRun | null, running = false): SyncStatusResponse => ({
  run: lastFinished,
  lastFinished,
  running,
  kevFeed: null,
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchSyncStatus).mockReset()
  vi.mocked(triggerSync).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('syncStore', () => {
  it('exposes the outcome of the last finished run', async () => {
    vi.mocked(fetchSyncStatus).mockResolvedValue(
      status(run(4, { status: 'failed', error: 'kubectl exited 1' })),
    )
    const sync = useSyncStore()

    await sync.refresh()

    expect(sync.ok).toBe(false)
    expect(sync.lastError).toBe('kubectl exited 1')
    expect(sync.lastSyncAt).toBe('2026-06-01T12:00:05.000Z')
  })

  it('bumps the data version only when a new run finished after the first answer', async () => {
    vi.mocked(fetchSyncStatus)
      .mockResolvedValueOnce(status(run(1)))
      .mockResolvedValueOnce(status(run(1)))
      .mockResolvedValueOnce(status(run(2)))
    const sync = useSyncStore()
    const dataVersion = useDataVersionStore()

    await sync.refresh()
    await sync.refresh()
    expect(dataVersion.version).toBe(0)

    await sync.refresh()
    expect(dataVersion.version).toBe(1)
  })

  it('runs a sync, marks it running meanwhile and refreshes afterwards', async () => {
    let finish: (value: SyncRun) => void = () => {}
    vi.mocked(fetchSyncStatus)
      .mockResolvedValueOnce(status(run(1)))
      .mockResolvedValueOnce(status(run(2)))
    vi.mocked(triggerSync).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const sync = useSyncStore()
    const dataVersion = useDataVersionStore()

    await sync.refresh()
    const pending = sync.sync()

    expect(sync.running).toBe(true)
    await sync.sync()
    expect(triggerSync).toHaveBeenCalledTimes(1)

    finish(run(2))
    await pending

    expect(sync.running).toBe(false)
    expect(dataVersion.version).toBe(1)
  })

  it('keeps a failed status fetch apart from the outcome of the last sync', async () => {
    vi.mocked(fetchSyncStatus)
      .mockResolvedValueOnce(status(run(1)))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
    const sync = useSyncStore()

    await sync.refresh()
    await sync.refresh()

    expect(sync.ok).toBe(true)
    expect(sync.lastError).toBeNull()
    expect(sync.fetchError).toBe('Failed to fetch')
  })

  it('schedules no poll when stopped before the first fetch answered', async () => {
    vi.useFakeTimers()
    let answer: (value: SyncStatusResponse) => void = () => {}
    vi.mocked(fetchSyncStatus).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }),
    )
    const sync = useSyncStore()

    const first = sync.startPolling()
    const second = sync.startPolling()

    sync.stopPolling()
    answer(status(run(1)))
    await first
    await second

    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps one poll timer when polling restarts', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchSyncStatus).mockResolvedValue(status(run(1)))
    const sync = useSyncStore()

    await Promise.all([sync.startPolling(), sync.startPolling()])

    expect(vi.getTimerCount()).toBe(1)
    sync.stopPolling()
    expect(vi.getTimerCount()).toBe(0)
  })
})
