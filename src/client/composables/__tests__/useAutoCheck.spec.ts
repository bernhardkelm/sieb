import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InboxResponse } from '#core/apiTypes.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { MAX_CHECK_FINDINGS } from '#core/checkLimits.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { createChecks, fetchChecks } from '@/api/checksApi'
import { useAutoCheck } from '@/composables/useAutoCheck'
import { useChecksStore } from '@/stores/checksStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(async () => ({
    items: [],
    counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: 0 },
  })),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

/**
 * Answers a create request by queueing every finding of it.
 * @param {number[]} ids - Finding ids of the request
 * @returns {Promise<CheckCreateResponse>} - Answer
 */
const queueAll = async (ids: number[]): Promise<CheckCreateResponse> => ({
  queued: ids.map((id) => buildCheck({ id, findingId: id, position: null })),
  skipped: [],
})

const IDS = Array.from({ length: MAX_CHECK_FINDINGS * 2 + 50 }, (_, index) => index + 1)

/**
 * Lets the pending fetches settle and returns the number of fetches so far.
 * @returns {Promise<number>} - Calls of fetchChecks
 */
const fetches = async (): Promise<number> => {
  await flushPromises()
  return vi.mocked(fetchChecks).mock.calls.length
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchChecks).mockReset().mockResolvedValue(buildChecksResponse())
  vi.mocked(createChecks).mockReset()
  vi.mocked(notifyError).mockClear()
  vi.mocked(notifySuccess).mockClear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

afterEach(() => {
  useChecksStore().stopPolling()
})

describe('useAutoCheck', () => {
  it('splits a large selection into requests and refetches once at the end', async () => {
    vi.mocked(createChecks).mockImplementation(queueAll)
    useChecksStore().startPolling()
    const before = await fetches()

    expect(await useAutoCheck().submit(IDS)).toBe(true)

    expect(vi.mocked(createChecks).mock.calls.map(([ids]) => ids.length)).toEqual([
      MAX_CHECK_FINDINGS,
      MAX_CHECK_FINDINGS,
      50,
    ])
    expect((await fetches()) - before).toBe(1)
    expect(notifySuccess).toHaveBeenCalledWith(`${IDS.length} Auto-checks queued`, undefined)
  })

  it('names the checks queued before a failed request and the findings left', async () => {
    const failure = new Error('network down')

    vi.mocked(createChecks).mockImplementationOnce(queueAll).mockRejectedValueOnce(failure)
    useChecksStore().startPolling()
    const before = await fetches()

    expect(await useAutoCheck().submit(IDS)).toBe(true)

    expect(createChecks).toHaveBeenCalledTimes(2)
    expect(notifyError).toHaveBeenCalledWith(
      `${MAX_CHECK_FINDINGS} Auto-checks queued, ${MAX_CHECK_FINDINGS + 50} not queued`,
      failure,
    )
    expect(notifySuccess).not.toHaveBeenCalled()
    expect((await fetches()) - before).toBe(1)
  })

  it('reports a failed first request as nothing queued', async () => {
    const failure = new Error('forbidden')

    vi.mocked(createChecks).mockRejectedValue(failure)

    expect(await useAutoCheck().submit([1, 2])).toBe(false)
    expect(notifyError).toHaveBeenCalledWith('Could not queue the Auto-check', failure)
  })
})
