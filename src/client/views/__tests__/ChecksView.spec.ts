import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountOnAppRoutes } from '@/__tests__/mountOnAppRoutes'
import { cancelCheck, fetchChecks } from '@/api/checksApi'
import { useChecksStore } from '@/stores/checksStore'
import { useMeStore } from '@/stores/meStore'
import { notifySuccess } from '@/toast/toastManager'
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

const RUNNING = buildCheck({
  id: 3,
  findingId: 8,
  vulnId: 'CVE-2099-10008',
  state: 'running',
  phase: 'investigating',
  position: null,
  startedAt: '2026-06-01T11:59:00.000Z',
})
const QUEUED = [
  buildCheck({ id: 4, findingId: 9, vulnId: 'CVE-2099-10009', position: 1 }),
  buildCheck({ id: 5, findingId: 10, vulnId: 'CVE-2099-10010', position: 2 }),
]
const DONE = buildCheck({
  id: 2,
  findingId: 7,
  state: 'done',
  position: null,
  proposalId: 12,
  finishedAt: '2026-06-01T11:58:00.000Z',
  durationMs: 187_000,
  usage: {
    inputTokens: 12_345,
    outputTokens: 1_104,
    cacheReadTokens: 30_000,
    cacheCreationTokens: 10_000,
    costUsd: 0.42,
    turns: 8,
    models: ['claude-opus-5-5'],
  },
  reply: '<img src=x onerror="alert(1)"> Not affected, see <b>proposal</b>.',
  pulledDigest: `sha256:${'ab'.repeat(32)}`,
  pulledImages: [
    { digest: `sha256:${'ab'.repeat(32)}`, tag: '18-alpine' },
    { digest: `sha256:${'cd'.repeat(32)}`, tag: null },
  ],
})
const FAILED = buildCheck({
  id: 1,
  findingId: 6,
  state: 'failed',
  position: null,
  error: 'Timed out: the worker sent no heartbeat for 2 minutes.',
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
  vi.mocked(cancelCheck).mockReset().mockResolvedValue()
  vi.mocked(notifySuccess).mockClear()
})

afterEach(() => {
  useChecksStore().stopPolling()
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('ChecksView', () => {
  it('shows the running check, the queue in order and the recent checks', async () => {
    const view = await mountView(
      buildChecksResponse({ running: RUNNING, queued: QUEUED, recent: [DONE, FAILED] }),
    )

    expect(view.get('#checks-running').text()).toContain('Worker online')
    expect(view.get('[data-check-state="running"]').text()).toMatch(/^Checking · investigating · /)
    expect(view.findAll('[aria-labelledby="checks-queue"] li').map((li) => li.text())).toEqual([
      expect.stringContaining('#1CVE-2099-10009'),
      expect.stringContaining('#2CVE-2099-10010'),
    ])

    const done = view.get('[data-check-id="2"]')

    expect(done.get('a[href="/checks?finding=7"]').text()).toBe('CVE-2099-10001')
    expect(done.get('a[href="/inbox/proposals/12"]').text()).toBe('Checked · proposal #12')
    expect(done.text()).toContain('3m 07s')
    expect(done.text()).toContain('12.3K in · 1,104 out · 40K cache')
    expect(done.text()).toContain('Modelclaude-opus-5-5')
    expect(done.text()).toContain('Turns8')
    expect(done.text()).toContain('$0.42 API-equivalent estimate')
    expect(done.text()).toContain(
      'Checked images18-alpine (sha256:abababababab), sha256:cdcdcdcdcdcd',
    )
    expect(view.get('[data-check-id="1"]').text()).not.toContain('Checked images')
    expect(view.get('[data-check-id="1"]').text()).toContain(
      'Timed out: the worker sent no heartbeat',
    )
  })

  it("renders Claude's reply as plain text, collapsed by default", async () => {
    const view = await mountView(buildChecksResponse({ recent: [DONE] }))
    const details = view.get<HTMLDetailsElement>('[data-check-id="2"] details')

    expect(details.element.open).toBe(false)
    expect(details.get('pre').text()).toBe(DONE.reply)
    expect(details.find('img').exists()).toBe(false)
    expect(details.find('b').exists()).toBe(false)
  })

  it('cancels a queued check at once and a running one only after the confirmation', async () => {
    const view = await mountView(buildChecksResponse({ running: RUNNING, queued: QUEUED }))

    await view.get('[aria-label="Cancel the queued check of CVE-2099-10009"]').trigger('click')
    await flushPromises()
    expect(cancelCheck).toHaveBeenCalledWith(4)
    expect(notifySuccess).toHaveBeenCalledWith('Check cancelled', 'CVE-2099-10009')

    await view.get('[aria-label="Cancel the running check of CVE-2099-10008"]').trigger('click')
    await flushPromises()
    expect(cancelCheck).toHaveBeenCalledTimes(1)

    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]')

    expect(dialog?.textContent).toContain('Claude stops investigating CVE-2099-10008')
    ;[...dialog!.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Cancel check')!
      .click()
    await flushPromises()
    expect(cancelCheck).toHaveBeenLastCalledWith(3)
  })

  it('shows an empty state with the worker state when nothing ran yet', async () => {
    const view = await mountView(buildChecksResponse({ workerOnline: false }))

    expect(view.text()).toContain('No checks yet')
    expect(view.text()).toContain('The worker is offline right now.')
  })

  it('explains a switched off feature with a link to the docs of the running version', async () => {
    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ enabled: false }))
    const mount = await mountOnAppRoutes(ChecksView)

    wrapper = mount.wrapper
    useMeStore().sourceCodeUrl = 'https://github.com/bernhardkelm/sieb/tree/0.4.0'
    await flushPromises()

    expect(wrapper.text()).toContain('Auto-check is off')
    expect(wrapper.get('a').attributes('href')).toBe(
      'https://github.com/bernhardkelm/sieb/blob/0.4.0/docs/auto-check.md',
    )
  })
})
