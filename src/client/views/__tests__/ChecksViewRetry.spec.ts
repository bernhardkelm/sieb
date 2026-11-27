import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckCreateResponse, ChecksResponse, CheckUsageWindow } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountOnAppRoutes } from '@/__tests__/mountOnAppRoutes'
import { createChecks, fetchChecks } from '@/api/checksApi'
import { useChecksStore } from '@/stores/checksStore'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'
import ChecksView from '@/views/ChecksView.vue'

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

const FAILED = buildCheck({
  id: 1,
  findingId: 6,
  vulnId: 'CVE-2099-10006',
  state: 'failed',
  position: null,
  error: 'boom',
})
const CANCELLED = buildCheck({
  id: 2,
  findingId: 7,
  vulnId: 'CVE-2099-10007',
  state: 'cancelled',
  position: null,
})
const DONE = buildCheck({ id: 3, findingId: 8, state: 'done', position: null, proposalId: 4 })
const OLDER_FAILED = buildCheck({ id: 0, findingId: 8, state: 'failed', position: null })

/**
 * Builds a usage window.
 * @param {Partial<CheckUsageWindow>} overrides - Fields to set
 * @returns {CheckUsageWindow} - Window
 */
const usageWindow = (overrides: Partial<CheckUsageWindow>): CheckUsageWindow => ({
  days: 7,
  checks: 0,
  withUsage: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheTokens: 0,
  costUsd: null,
  averageDurationMs: null,
  ...overrides,
})

let wrapper: VueWrapper | null = null

/**
 * Mounts the Checks page with a checks answer.
 * @param {ChecksResponse} answer - Checks answer
 * @returns {Promise<VueWrapper>} - Wrapper
 */
const mountView = async (answer: ChecksResponse): Promise<VueWrapper> => {
  vi.mocked(fetchChecks).mockResolvedValue(answer)
  wrapper = (await mountOnAppRoutes(ChecksView)).wrapper
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  vi.mocked(fetchChecks).mockReset()
  vi.mocked(createChecks).mockReset()
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyNotice).mockClear()
})

afterEach(() => {
  useChecksStore().stopPolling()
  wrapper?.unmount()
  wrapper = null
})

describe('ChecksView retry', () => {
  it('offers Retry on the latest failed or cancelled check of a finding only', async () => {
    const view = await mountView(
      buildChecksResponse({ recent: [FAILED, CANCELLED, DONE, OLDER_FAILED] }),
    )
    const buttons = view.findAll('[data-retry-check]')

    expect(buttons.map((button) => button.attributes('data-retry-check'))).toEqual(['1', '2'])
    expect(buttons[0]?.element.tagName).toBe('BUTTON')
    expect(buttons[0]?.attributes('aria-label')).toBe('Retry the Auto-check of CVE-2099-10006')
    expect(buttons[0]?.attributes('tabindex')).toBeUndefined()
  })

  it('re-queues the finding through POST /api/checks with the usual toast', async () => {
    const view = await mountView(buildChecksResponse({ recent: [FAILED] }))

    vi.mocked(createChecks).mockResolvedValue({
      queued: [buildCheck({ id: 9, findingId: 6, position: 1 })],
      skipped: [],
    })
    await view.get('[data-retry-check="1"]').trigger('click')
    await flushPromises()

    expect(createChecks).toHaveBeenCalledWith([6])
    expect(notifySuccess).toHaveBeenCalledWith('Auto-check queued at #1', undefined)
  })

  it('names the skip reason when the server queues nothing', async () => {
    const view = await mountView(buildChecksResponse({ recent: [CANCELLED] }))

    vi.mocked(createChecks).mockResolvedValue({
      queued: [],
      skipped: [{ findingId: 7, reason: 'resolved' }],
    })
    await view.get('[data-retry-check="2"]').trigger('click')
    await flushPromises()

    expect(notifyNotice).toHaveBeenCalledWith('No check queued', 'Skipped 1: 1 resolved.')
  })

  it('blocks the retry while the worker is offline', async () => {
    const view = await mountView(buildChecksResponse({ workerOnline: false, recent: [FAILED] }))
    const button = view.get('[data-retry-check="1"]')

    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('title')).toContain('worker is offline')
    await button.trigger('click')
    await flushPromises()
    expect(createChecks).not.toHaveBeenCalled()
  })
})

describe('ChecksView usage', () => {
  it('shows both windows with tokens, the labelled cost estimate and the average duration', async () => {
    const view = await mountView(
      buildChecksResponse({
        recent: [DONE],
        usage: {
          last7Days: usageWindow({ checks: 2, inputTokens: 12_345, costUsd: 0.42 }),
          last30Days: usageWindow({
            days: 30,
            checks: 9,
            withUsage: 8,
            inputTokens: 98_000,
            outputTokens: 4_100,
            cacheTokens: 250_000,
            costUsd: 3.5,
            averageDurationMs: 187_000,
          }),
        },
      }),
    )
    const rows = view
      .get('[aria-labelledby="checks-usage"]')
      .findAll('tbody tr')
      .map((row) => row.findAll('th, td').map((cell) => cell.text()))

    expect(rows).toEqual([
      ['Checks', '2', '9'],
      ['Input tokens', '12.3K', '98K'],
      ['Output tokens', '0', '4,100'],
      ['Cache tokens', '0', '250K'],
      ['Cost, API-equivalent estimate', '$0.42', '$3.50'],
      ['Average duration', 'none', '3m 07s'],
    ])
    expect(view.get('[aria-labelledby="checks-usage"]').text()).toContain(
      'counted against plan limits with a subscription',
    )
  })

  it('leaves the summary out when the server sends none', async () => {
    const view = await mountView(buildChecksResponse({ recent: [DONE] }))

    expect(view.find('[aria-labelledby="checks-usage"]').exists()).toBe(false)
  })
})
