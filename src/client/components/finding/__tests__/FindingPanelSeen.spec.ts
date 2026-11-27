import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetail } from '#core/findingView.ts'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail, markFindingsSeen } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'
import { DWELL_MS } from '@/composables/useFindingDwell'
import { SEEN_FLUSH_MS } from '@/stores/findingSeenStore'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetail>>(),
  markFindingsSeen: vi.fn<typeof markFindingsSeen>(async () => ({ ignored: [] })),
}))

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: unknown) => void>(),
}))

const writeText = vi.fn<(text: string) => Promise<void>>()
let mounted: RoutedMount | null = null

/**
 * Opens the panel of finding 1 with the Claude integration on and connected.
 * @returns {Promise<HTMLElement>} - Panel element
 */
const openPanel = async (): Promise<HTMLElement> => {
  vi.mocked(fetchFindingDetail).mockResolvedValue({
    finding: buildFindingView({ id: 1, firstSeen: new Date().toISOString() }),
    instances: [],
    decisions: [],
    events: [],
    kev: null,
    imageVisibility: 'unknown',
    ownership: 'own',
  })
  mounted = await mountWithRouter(FindingPanel, '/triage?finding=1')
  useMcpStore().info = {
    enabled: true,
    mcpUrl: 'https://sieb.example.com/mcp',
    oauth: true,
    claude: { connected: true, activeTokens: 1, oauthLastSeenAt: null },
  }
  await flushPromises()

  return mounted.wrapper.get<HTMLElement>('.finding-panel').element
}

/**
 * Lets the seen marks flush and returns the id lists sent so far.
 * @param {number} ms - Time to advance
 * @returns {Promise<number[][]>} - Ids per request
 */
const sentAfter = async (ms: number): Promise<number[][]> => {
  await vi.advanceTimersByTimeAsync(ms)
  return vi.mocked(markFindingsSeen).mock.calls.map(([ids]) => ids)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  writeText.mockReset().mockResolvedValue()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.mocked(markFindingsSeen).mockClear()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('FindingPanel seen marks', () => {
  it('marks the shown finding seen after it stayed shown for two seconds', async () => {
    await openPanel()

    expect(await sentAfter(DWELL_MS - 1 + SEEN_FLUSH_MS)).toEqual([])
    expect(await sentAfter(1)).toEqual([[1]])
  })

  it('marks the finding at once when a value of the panel is copied', async () => {
    const panel = await openPanel()

    panel.querySelector<HTMLElement>('[aria-label="Copy CVE ID"]')!.click()
    await flushPromises()

    expect(await sentAfter(SEEN_FLUSH_MS)).toEqual([[1]])
  })

  it('marks the finding at once when the prompt is handed off by key', async () => {
    const panel = await openPanel()

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    expect(await sentAfter(SEEN_FLUSH_MS)).toEqual([[1]])
  })
})
