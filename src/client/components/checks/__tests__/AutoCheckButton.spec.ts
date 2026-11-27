import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import type { SourceAccess } from '#core/sourceAccess.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { createChecks } from '@/api/checksApi'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'
import {
  CHECKS_OFF_REASON,
  NOT_PUBLIC_REASON,
  WORKER_OFFLINE_REASON,
} from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetailResponse>>(),
}))
vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(async () => buildChecksResponse()),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: unknown) => void>(),
}))

let mounted: RoutedMount | null = null

/**
 * Opens the panel of finding 1 with the Claude integration on.
 * @param {SourceAccess} sourceAccess - Source access of the image
 * @param {ChecksResponse | null} checks - Checks answer, null before one arrived
 * @returns {Promise<RoutedMount>} - Mounted panel
 */
const openPanel = async (
  sourceAccess: SourceAccess,
  checks: ChecksResponse | null,
): Promise<RoutedMount> => {
  vi.mocked(fetchFindingDetail).mockResolvedValue({
    finding: buildFindingView({ id: 1 }),
    instances: [],
    decisions: [],
    events: [],
    kev: null,
    sourceAccess,
  })
  mounted = await mountWithRouter(FindingPanel, '/triage?finding=1')
  useMcpStore().info = {
    enabled: true,
    mcpUrl: 'https://sieb.example.com/mcp',
    oauth: false,
    claude: { connected: true, activeTokens: 1, oauthLastSeenAt: null },
  }
  useChecksStore().response = checks
  await flushPromises()
  return mounted
}

/**
 * Returns the Auto-check button.
 * @returns {HTMLButtonElement} - Button
 */
const button = (): HTMLButtonElement =>
  mounted!.wrapper.get<HTMLButtonElement>('.auto-check-button').element

beforeEach(() => {
  vi.mocked(createChecks).mockReset()
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyNotice).mockClear()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
})

describe('Auto-check button', () => {
  it.each([
    [
      'the worker is offline',
      'public',
      buildChecksResponse({ workerOnline: false }),
      WORKER_OFFLINE_REASON,
    ],
    ['the image is not public', 'private', buildChecksResponse(), NOT_PUBLIC_REASON],
    [
      'a check is already open',
      'public',
      buildChecksResponse({ queued: [buildCheck({ findingId: 1, position: 3 })] }),
      'A check of this finding is already queued at #3.',
    ],
  ] as const)('is blocked while %s', async (_case, access, checks, reason) => {
    await openPanel(access, checks)

    expect(button().getAttribute('aria-disabled')).toBe('true')
    expect(button().hasAttribute('tabindex')).toBe(false)
    expect(button().getAttribute('aria-label')).toBe('Auto-check')
    expect(useHintActionsStore().reasonOf('autoCheck')).toBe(reason)

    button().click()
    await flushPromises()
    expect(createChecks).not.toHaveBeenCalled()
  })

  it('renders no Auto-check while the feature is off, the hint stays blocked with the reason', async () => {
    await openPanel('public', null)

    expect(mounted!.wrapper.find('.auto-check-button').exists()).toBe(false)
    expect(useHintActionsStore().reasonOf('autoCheck')).toBe(CHECKS_OFF_REASON)

    useChecksStore().response = buildChecksResponse({ enabled: false })
    await flushPromises()
    expect(mounted!.wrapper.find('.auto-check-button').exists()).toBe(false)
  })

  it('queues the panel finding and names the skipped findings in the toast', async () => {
    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ findingId: 1, position: 2 })],
      skipped: [],
    })
    await openPanel('public', buildChecksResponse())

    expect(button().hasAttribute('aria-disabled')).toBe(false)
    button().click()
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([1])
    expect(notifySuccess).toHaveBeenCalledWith('Auto-check queued at #2', undefined)
  })

  it('reports a create answer that skipped everything as a notice', async () => {
    vi.mocked(createChecks).mockResolvedValue({
      queued: [],
      skipped: [{ findingId: 1, reason: 'not_public' }],
    })
    await openPanel('public', buildChecksResponse())

    button().click()
    await flushPromises()

    expect(notifyNotice).toHaveBeenCalledWith(
      'No check queued',
      'Skipped 1: 1 without access to the image.',
    )
  })

  it('queues on Shift+C in the panel and explains a blocked press', async () => {
    vi.mocked(createChecks).mockResolvedValue({ queued: [buildCheck()], skipped: [] })
    await openPanel('public', buildChecksResponse())
    const panel = mounted!.wrapper.get<HTMLElement>('.finding-panel').element

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }))
    await flushPromises()
    expect(createChecks).not.toHaveBeenCalled()

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', shiftKey: true, bubbles: true }))
    await flushPromises()
    expect(createChecks).toHaveBeenCalledWith([1])

    useChecksStore().response = buildChecksResponse({ workerOnline: false })
    await flushPromises()
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', shiftKey: true, bubbles: true }))
    await flushPromises()
    expect(notifyNotice).toHaveBeenCalledWith('No Auto-check queued', WORKER_OFFLINE_REASON)
  })
})
