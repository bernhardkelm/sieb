import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { StatsResponse } from '#core/apiTypes.ts'
import type { StatsRange } from '#core/statsRange.ts'
import { buildStatsResponse } from '@/__tests__/statsBuilders'
import { fetchStats } from '@/api/statsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { STATS_RANGE_STORAGE_KEY, useStatsStore } from '@/stores/statsStore'

vi.mock('@/api/statsApi', () => ({
  fetchStats: vi.fn<(range?: StatsRange) => Promise<StatsResponse>>(),
}))

/**
 * Waits for pending promises and watchers.
 * @returns {Promise<void>} - Resolves after the queue drained
 */
const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.mocked(fetchStats).mockReset()
})

describe('statsStore', () => {
  it('loads the default range once and refetches when the data version moves', async () => {
    vi.mocked(fetchStats)
      .mockResolvedValueOnce(buildStatsResponse({ inbox: 4 }))
      .mockResolvedValueOnce(buildStatsResponse({ inbox: 3 }))
    const store = useStatsStore()

    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(fetchStats).toHaveBeenCalledTimes(1)
    expect(fetchStats).toHaveBeenLastCalledWith('30d')

    useDataVersionStore().bump()
    await flush()

    expect(fetchStats).toHaveBeenCalledTimes(2)
    expect(store.data?.current.inbox).toBe(3)
  })

  it('does not fetch on a version bump before the first load', async () => {
    useStatsStore()

    useDataVersionStore().bump()
    await flush()

    expect(fetchStats).not.toHaveBeenCalled()
  })

  it('remembers the selected range and starts with it next time', async () => {
    vi.mocked(fetchStats).mockResolvedValue(buildStatsResponse({}))
    const store = useStatsStore()

    await store.setRange('7d')

    expect(fetchStats).toHaveBeenLastCalledWith('7d')
    expect(localStorage.getItem(STATS_RANGE_STORAGE_KEY)).toBe('7d')

    setActivePinia(createPinia())
    expect(useStatsStore().range).toBe('7d')
  })

  it('falls back to the default range for an unknown stored value', () => {
    localStorage.setItem(STATS_RANGE_STORAGE_KEY, '1y')

    expect(useStatsStore().range).toBe('30d')
  })

  it('keeps the last answer when a refetch fails and drops an overtaken one', async () => {
    let finishFirst: (value: StatsResponse) => void = () => {}
    vi.mocked(fetchStats)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirst = resolve
        }),
      )
      .mockResolvedValueOnce(buildStatsResponse({ open: 2 }))
      .mockRejectedValueOnce(new Error('offline'))
    const store = useStatsStore()

    const first = store.refresh()
    await store.refresh()
    finishFirst(buildStatsResponse({ open: 1 }))
    await first
    await store.refresh()

    expect(store.data?.current.open).toBe(2)
    expect(store.error).toBe('offline')
  })
})
