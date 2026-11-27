import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountOnAppRoutes } from '@/__tests__/mountOnAppRoutes'
import { createChecks, fetchChecks } from '@/api/checksApi'
import FindingCheckLine from '@/components/checks/FindingCheckLine.vue'
import { useChecksStore } from '@/stores/checksStore'
import { notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

const FAILED = buildCheck({ id: 5, findingId: 6, state: 'failed', position: null, error: 'boom' })

/**
 * Mounts the panel line of finding 6 over a checks answer.
 * @param {ChecksResponse} answer - Checks answer
 * @returns {Promise<import('@vue/test-utils').VueWrapper>} - Wrapper
 */
const mountLine = async (answer: ChecksResponse) => {
  vi.mocked(fetchChecks).mockResolvedValue(answer)
  const { wrapper } = await mountOnAppRoutes(FindingCheckLine, { findingId: 6 })

  await useChecksStore().refresh()
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(fetchChecks).mockReset()
  vi.mocked(createChecks).mockReset()
  vi.mocked(notifySuccess).mockClear()
})

afterEach(() => {
  useChecksStore().stopPolling()
})

describe('FindingCheckLine retry', () => {
  it('re-queues the finding from the failed chip line', async () => {
    const line = await mountLine(buildChecksResponse({ recent: [FAILED] }))

    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ id: 7, findingId: 6, position: 2 })],
      skipped: [],
    })
    expect(line.get('[data-check-state="failed"]').text()).toBe('Check failed')
    await line.get('button[data-retry-check="5"]').trigger('click')
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([6])
    expect(notifySuccess).toHaveBeenCalledWith('Auto-check queued at #2', undefined)
    line.unmount()
  })

  it('offers no retry once the finding is queued again', async () => {
    const line = await mountLine(
      buildChecksResponse({
        queued: [buildCheck({ id: 7, findingId: 6, position: 1 })],
        recent: [FAILED],
      }),
    )

    expect(line.find('[data-retry-check]').exists()).toBe(false)
    expect(line.get('[data-check-state="queued"]').text()).toBe('Queued · #1')
    line.unmount()
  })
})
