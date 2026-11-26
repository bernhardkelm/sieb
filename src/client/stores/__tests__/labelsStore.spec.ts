import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LabelsResponse } from '#core/apiTypes.ts'
import { fetchLabels } from '@/api/labelsApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useLabelsStore } from '@/stores/labelsStore'

vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<LabelsResponse>>(),
}))

/**
 * Waits for pending promises.
 * @returns {Promise<void>} - Resolves after the queue drained
 */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchLabels).mockReset()
})

describe('labelsStore', () => {
  it('hides exposure and owner until loaded and when no open finding has them', async () => {
    vi.mocked(fetchLabels).mockResolvedValue({ exposure: false, owners: [], kev: 'cisa' })
    const labels = useLabelsStore()

    expect([labels.showExposure, labels.showOwner]).toEqual([false, false])
    await labels.ensureLoaded()
    expect([labels.showExposure, labels.showOwner]).toEqual([false, false])
  })

  it('shows what the data carries and refetches after a sync', async () => {
    vi.mocked(fetchLabels)
      .mockResolvedValueOnce({ exposure: true, owners: [], kev: 'cisa' })
      .mockResolvedValueOnce({ exposure: true, owners: ['self', 'ops'], kev: 'cisa' })
    const labels = useLabelsStore()

    await labels.ensureLoaded()
    await labels.ensureLoaded()
    expect(fetchLabels).toHaveBeenCalledTimes(1)
    expect([labels.showExposure, labels.showOwner]).toEqual([true, false])

    useDataVersionStore().bump()
    await flush()

    expect(fetchLabels).toHaveBeenCalledTimes(2)
    expect(labels.showOwner).toBe(true)
    expect(labels.owners).toEqual(['self', 'ops'])
  })

  it('keeps the last answer when a refetch fails and skips bumps before the first load', async () => {
    vi.mocked(fetchLabels)
      .mockResolvedValueOnce({ exposure: true, owners: ['self'], kev: 'cisa' })
      .mockRejectedValueOnce(new Error('offline'))
    const labels = useLabelsStore()

    useDataVersionStore().bump()
    await flush()
    expect(fetchLabels).not.toHaveBeenCalled()

    await labels.ensureLoaded()
    useDataVersionStore().bump()
    await flush()

    expect(fetchLabels).toHaveBeenCalledTimes(2)
    expect(labels.owners).toEqual(['self'])
  })

  it('shows KEV until the server answers the KEV source none', async () => {
    vi.mocked(fetchLabels)
      .mockResolvedValueOnce({ exposure: false, owners: [], kev: 'prometheus' })
      .mockResolvedValueOnce({ exposure: false, owners: [], kev: 'none' })
    const labels = useLabelsStore()

    expect([labels.kevSource, labels.showKev]).toEqual([null, true])
    await labels.ensureLoaded()
    expect([labels.kevSource, labels.showKev]).toEqual(['prometheus', true])

    await labels.refresh()
    expect([labels.kevSource, labels.showKev]).toEqual(['none', false])
  })
})
