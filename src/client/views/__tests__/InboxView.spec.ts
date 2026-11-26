import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingView } from '#core/findingView.ts'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useFindingsStore } from '@/stores/findingsStore'
import InboxView from '@/views/InboxView.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

const DAY_MS = 24 * 60 * 60 * 1000

let mounted: RoutedMount | null = null

/**
 * Mounts the inbox with loaded findings.
 * @param {FindingView[]} findings - Findings the API returns
 * @returns {Promise<RoutedMount>} - Mounted view once the findings are loaded
 */
const mountInbox = async (findings: FindingView[]): Promise<RoutedMount> => {
  vi.mocked(fetchFindings).mockResolvedValue(findings)
  mounted = await mountWithRouter(InboxView, '/inbox')
  await useFindingsStore().refresh()
  await flushPromises()
  return mounted
}

/**
 * Builds a finding that left the inbox through an active decision.
 * @param {number} id - Finding and decision id
 * @param {string | null} expiresAt - Expiry of the decision
 * @returns {FindingView} - Decided finding
 */
const decided = (id: number, expiresAt: string | null = null): FindingView =>
  buildFindingView({
    id,
    decision: buildDecision({ id, status: 'accepted', expiresAt }),
    effective: { state: 'active' },
    inInbox: false,
  })

beforeEach(() => {
  // jsdom lacks window.scrollTo, the virtualizer corrects the scroll position as rows measure
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // jsdom lacks scrollIntoView, the list reveals its current row
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('InboxView empty states', () => {
  it('shows the all clear state with its next steps when every finding is decided', async () => {
    const soon = new Date(Date.now() + 3 * DAY_MS).toISOString()
    const { wrapper } = await mountInbox([decided(1, soon), decided(2, soon), decided(3)])

    expect(wrapper.get('h2').text()).toBe('All clear')

    const links = wrapper.findAll('.all-clear a')

    expect(links.map((link) => link.text())).toEqual([
      'Review decisions',
      '2 decisions expire within 14 days',
    ])
    expect(links[1]?.attributes('href')).toBe('/decisions?state=expiring')
  })

  it('leaves out the expiring link when nothing expires soon', async () => {
    const { wrapper } = await mountInbox([decided(1)])

    expect(wrapper.findAll('.all-clear a').map((link) => link.text())).toEqual(['Review decisions'])
  })

  it('keeps the filtered empty state while a filter is set', async () => {
    const { wrapper } = await mountInbox([decided(1)])

    useFindingsStore().setFilters({ q: 'openssl' })
    await flushPromises()

    expect(wrapper.find('.all-clear').exists()).toBe(false)
    expect(wrapper.text()).toContain('No inbox findings match these filters.')
    expect(wrapper.text()).toContain('Reset filters')
  })

  it('lists inbox findings instead of the all clear state', async () => {
    const { wrapper } = await mountInbox([buildFindingView({ id: 1 }), decided(2)])

    expect(wrapper.find('.all-clear').exists()).toBe(false)
  })
})
