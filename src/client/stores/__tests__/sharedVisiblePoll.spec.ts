import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSharedVisiblePoll } from '@/stores/sharedVisiblePoll'

const task = vi.fn<() => Promise<void>>()

beforeEach(() => {
  vi.useFakeTimers()
  task.mockReset().mockResolvedValue()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSharedVisiblePoll', () => {
  it('runs one poll for every holder and stops it with the last release', async () => {
    const hold = createSharedVisiblePoll(task, 1_000)
    const releaseFirst = hold()
    const releaseSecond = hold()

    await vi.advanceTimersByTimeAsync(0)
    expect(task).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(task).toHaveBeenCalledTimes(2)

    releaseFirst()
    releaseFirst()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(task).toHaveBeenCalledTimes(3)

    releaseSecond()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(task).toHaveBeenCalledTimes(3)
  })
})
