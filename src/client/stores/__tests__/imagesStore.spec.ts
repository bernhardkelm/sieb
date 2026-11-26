import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { ImageAggregate } from '#core/imageAggregation.ts'
import { fetchImages } from '@/api/imagesApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useImagesStore } from '@/stores/imagesStore'

vi.mock('@/api/imagesApi', () => ({
  fetchImages: vi.fn<() => Promise<ImageAggregate[]>>(),
}))

/**
 * Builds an image aggregate.
 * @param {string} imageRef - Image
 * @returns {ImageAggregate} - Aggregate
 */
const image = (imageRef: string): ImageAggregate => ({
  imageRef,
  owner: 'self',
  maxExposure: 'public',
  maxSeverity: 'High',
  openCount: 1,
  openBySeverity: { Critical: 0, High: 1, Medium: 0, Low: 0, Unknown: 0 },
  fixableCount: 1,
  kevCount: 0,
  inboxCount: 1,
  suppressedCount: 0,
  workloadCount: 1,
  workloads: ['shop/Deployment/web'],
})

/**
 * Waits for pending promises and watchers.
 * @returns {Promise<void>} - Resolves after the queue drained
 */
const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchImages).mockReset()
})

describe('imagesStore', () => {
  it('loads once and refetches when the data version moves', async () => {
    vi.mocked(fetchImages)
      .mockResolvedValueOnce([image('a')])
      .mockResolvedValueOnce([image('a'), image('b')])
    const store = useImagesStore()

    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(fetchImages).toHaveBeenCalledTimes(1)
    expect(store.items.map((item) => item.imageRef)).toEqual(['a'])

    useDataVersionStore().bump()
    await flush()

    expect(fetchImages).toHaveBeenCalledTimes(2)
    expect(store.items.map((item) => item.imageRef)).toEqual(['a', 'b'])
  })

  it('keeps the last items and records the error when a refetch fails', async () => {
    vi.mocked(fetchImages)
      .mockResolvedValueOnce([image('a')])
      .mockRejectedValueOnce(new Error('offline'))
    const store = useImagesStore()

    await store.refresh()
    await store.refresh()

    expect(store.loaded).toBe(true)
    expect(store.error).toBe('offline')
    expect(store.items).toHaveLength(1)
  })

  it('drops the answer of a refresh overtaken by a newer one', async () => {
    let finishFirst: (value: ImageAggregate[]) => void = () => {}
    vi.mocked(fetchImages)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirst = resolve
        }),
      )
      .mockResolvedValueOnce([image('new')])
    const store = useImagesStore()

    const first = store.refresh()
    await store.refresh()
    finishFirst([image('old')])
    await first

    expect(store.items.map((item) => item.imageRef)).toEqual(['new'])
  })
})
