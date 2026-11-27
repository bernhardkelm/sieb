import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { InboxResponse } from '#core/inboxApiTypes.ts'
import type { ChecksResponse } from '#core/check.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { fetchChecks } from '@/api/checksApi'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { ROUTE_NAMES } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(() => new Promise(() => {})),
}))
vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(),
}))

let wrapper: VueWrapper | null = null

/**
 * Mounts the sidebar on a memory router at a path, with the overview panels stubbed.
 * @param {string} path - Starting path
 * @returns {Promise<VueWrapper>} - Sidebar wrapper once the checks answer arrived
 */
const mountSidebar = async (path: string): Promise<VueWrapper> => {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: Object.values(ROUTE_NAMES).map((name) => ({
      path: `/${name}`,
      name,
      component: { render: () => null },
    })),
  })

  setActivePinia(pinia)
  await router.push(path)
  await router.isReady()

  wrapper = mount(AppSidebar, {
    global: { plugins: [pinia, router], stubs: { OverviewStats: true } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

/**
 * Returns the labels of the hints.
 * @param {VueWrapper} sidebar - Sidebar wrapper
 * @returns {string[]} - Hint labels
 */
const hintLabels = (sidebar: VueWrapper): string[] =>
  sidebar
    .findAll('.hints li > *')
    .map((item) => item.findAll('span:not([hidden])').at(-1)?.text() ?? '')

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

afterEach(() => {
  useChecksStore().stopPolling()
  wrapper?.unmount()
  wrapper = null
})

describe('AppSidebar checks', () => {
  it('lists Checks on key 6 with the open checks as a badge while Auto-check is on', async () => {
    vi.mocked(fetchChecks).mockResolvedValue(
      buildChecksResponse({
        running: buildCheck({ id: 1, state: 'running', position: null }),
        queued: [buildCheck({ id: 2, findingId: 2 }), buildCheck({ id: 3, findingId: 3 })],
      }),
    )
    const sidebar = await mountSidebar('/triage')
    const checks = sidebar.findAll('.nav .link').at(-1)!

    expect(checks.find('.label').text()).toBe('Checks')
    expect(checks.attributes('aria-keyshortcuts')).toBe('6')
    expect(checks.get('.badge').text()).toBe('3 open')
  })

  it('shows no badge without open checks and no Checks item with Auto-check off', async () => {
    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse())
    const idle = await mountSidebar('/triage')

    expect(idle.findAll('.nav .link').at(-1)!.find('.badge').exists()).toBe(false)
    idle.unmount()

    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse({ enabled: false }))
    const off = await mountSidebar('/triage')

    expect(off.findAll('.nav .label').map((label) => label.text())).not.toContain('Checks')
  })

  it('lists the Auto-check hint on Triage only with Claude and Auto-check on', async () => {
    vi.mocked(fetchChecks).mockResolvedValue(buildChecksResponse())
    const sidebar = await mountSidebar('/triage')

    expect(hintLabels(sidebar)).not.toContain('Auto-check')

    useMcpStore().info = { enabled: true, mcpUrl: null, oauth: false, claude: null }
    await flushPromises()
    expect(hintLabels(sidebar)).toContain('Auto-check')

    useChecksStore().response = buildChecksResponse({ enabled: false })
    await flushPromises()
    expect(hintLabels(sidebar)).not.toContain('Auto-check')
  })
})
