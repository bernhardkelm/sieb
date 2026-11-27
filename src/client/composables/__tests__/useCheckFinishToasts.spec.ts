import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import type { InboxResponse } from '#core/inboxApiTypes.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountOnAppRoutes } from '@/__tests__/mountOnAppRoutes'
import { fetchChecks } from '@/api/checksApi'
import { useCheckFinishToasts } from '@/composables/useCheckFinishToasts'
import { useChecksStore } from '@/stores/checksStore'
import { useMeStore } from '@/stores/meStore'
import {
  notifyError,
  notifySuccess,
  notifyWithAction,
  type ToastActionChoice,
} from '@/toast/toastManager'

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
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: ToastActionChoice) => void>(),
}))

const Host = defineComponent({
  setup: () => {
    useCheckFinishToasts()
  },
  render: () => null,
})

const RUNNING = buildCheck({ id: 1, state: 'running', position: null })
const QUEUED = buildCheck({ id: 2, findingId: 2, position: 1 })

/**
 * Answers the next poll with a checks answer and runs it.
 * @param {ChecksResponse} answer - Checks answer
 * @returns {Promise<void>} - Resolves once stored
 */
const poll = async (answer: ChecksResponse): Promise<void> => {
  vi.mocked(fetchChecks).mockResolvedValueOnce(answer)
  await useChecksStore().refresh()
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(fetchChecks).mockReset()
  vi.mocked(notifyError).mockClear()
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyWithAction).mockClear()
})

afterEach(() => {
  useChecksStore().stopPolling()
})

describe('useCheckFinishToasts', () => {
  it("toasts the user's checks that end while polling, with a Review link to the proposal", async () => {
    const { wrapper, router } = await mountOnAppRoutes(Host)

    useMeStore().username = 'alice'
    await poll(
      buildChecksResponse({
        running: RUNNING,
        queued: [QUEUED],
        recent: [buildCheck({ id: 9, state: 'failed', position: null, error: 'old' })],
      }),
    )
    expect(notifyError).not.toHaveBeenCalled()

    await poll(
      buildChecksResponse({
        running: { ...QUEUED, state: 'running', position: null },
        recent: [{ ...RUNNING, state: 'done', proposalId: 12 }],
      }),
    )
    expect(notifyWithAction).toHaveBeenCalledWith(
      'check-finished-1',
      'Auto-check done: CVE-2099-10001 · nginx',
      'Proposal #12',
      expect.objectContaining({ label: 'Review', altText: 'Review proposal #12' }),
    )
    vi.mocked(notifyWithAction).mock.calls[0]?.[3].onClick()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/inbox/proposals/12')

    const failed = { ...QUEUED, state: 'failed' as const, position: null, error: 'Pull failed' }

    await poll(buildChecksResponse({ recent: [failed, { ...RUNNING, state: 'done' }] }))
    await poll(buildChecksResponse({ recent: [failed, { ...RUNNING, state: 'done' }] }))
    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(notifyError).toHaveBeenCalledWith('Auto-check failed: CVE-2099-10001', 'Pull failed')
    expect(notifyWithAction).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it("stays silent for other users' checks and for a done check without a proposal says so", async () => {
    const { wrapper } = await mountOnAppRoutes(Host)

    useMeStore().username = 'alice'
    await poll(
      buildChecksResponse({ running: RUNNING, queued: [{ ...QUEUED, requestedBy: 'bob' }] }),
    )
    await poll(
      buildChecksResponse({
        recent: [
          { ...QUEUED, requestedBy: 'bob', state: 'done', position: null },
          { ...RUNNING, state: 'done' },
        ],
      }),
    )

    expect(notifySuccess).toHaveBeenCalledTimes(1)
    expect(notifySuccess).toHaveBeenCalledWith(
      'Auto-check done: CVE-2099-10001 · nginx',
      'Checked, no proposal',
    )
    wrapper.unmount()
  })
})
