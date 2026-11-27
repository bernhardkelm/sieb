import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { createChecks } from '@/api/checksApi'
import TriageSelectionBar from '@/components/triage/TriageSelectionBar.vue'
import { ALL_OPEN_REASON, WORKER_OFFLINE_REASON } from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'
import { useHandoffSelectionStore } from '@/stores/handoffSelectionStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'

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

let wrapper: VueWrapper | null = null

/**
 * Mounts the bar with checked findings in the selection store and the Claude integration on.
 * @param {number[]} ids - Checked finding ids
 * @returns {VueWrapper} - Bar wrapper
 */
const mountBar = (ids: number[]): VueWrapper => {
  const pinia = createPinia()

  setActivePinia(pinia)
  useMcpStore().info = { enabled: true, mcpUrl: null, oauth: false, claude: null }
  useHandoffSelectionStore().register(() => ids.map((id) => buildFindingView({ id })))
  wrapper = mount(TriageSelectionBar, {
    props: { count: ids.length },
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  return wrapper
}

/**
 * Returns the Auto-check button of the bar.
 * @returns {HTMLButtonElement} - Button
 */
const autoCheck = (): HTMLButtonElement => wrapper!.get<HTMLButtonElement>('.auto-check').element

beforeEach(() => {
  vi.mocked(createChecks).mockReset()
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyNotice).mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TriageSelectionBar Auto-check', () => {
  it('queues the checked rows without an open check and names the skipped ones', async () => {
    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ id: 7, findingId: 1 })],
      skipped: [{ findingId: 3, reason: 'not_public' }],
    })
    mountBar([1, 2, 3])
    useChecksStore().response = buildChecksResponse({ queued: [buildCheck({ findingId: 2 })] })
    await flushPromises()

    autoCheck().click()
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([1, 3])
    expect(notifySuccess).toHaveBeenCalledWith(
      'Auto-check queued at #1',
      'Skipped 1: 1 not on a public image.',
    )
  })

  it('is blocked with a reason while the worker is offline or every row has an open check', async () => {
    mountBar([2])
    useChecksStore().response = buildChecksResponse({ queued: [buildCheck({ findingId: 2 })] })
    await flushPromises()

    expect(autoCheck().getAttribute('aria-disabled')).toBe('true')
    expect(autoCheck().title).toBe(ALL_OPEN_REASON)

    useChecksStore().response = buildChecksResponse({ workerOnline: false })
    await flushPromises()
    expect(autoCheck().title).toBe(WORKER_OFFLINE_REASON)
    expect(autoCheck().hasAttribute('tabindex')).toBe(false)
    expect(
      document.getElementById(autoCheck().getAttribute('aria-describedby')!)?.textContent,
    ).toBe(WORKER_OFFLINE_REASON)

    autoCheck().click()
    await flushPromises()
    expect(createChecks).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledWith('No Auto-check queued', WORKER_OFFLINE_REASON)
  })

  it('renders no Auto-check while the feature is off', async () => {
    mountBar([1])
    await flushPromises()
    expect(wrapper!.find('.auto-check').exists()).toBe(false)

    useChecksStore().response = buildChecksResponse({ enabled: false })
    await flushPromises()
    expect(wrapper!.find('.auto-check').exists()).toBe(false)

    useChecksStore().response = buildChecksResponse()
    await flushPromises()
    expect(wrapper!.find('.auto-check').exists()).toBe(true)
  })
})
