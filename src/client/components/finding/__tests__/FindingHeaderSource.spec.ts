import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/apiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingHeader from '@/components/finding/FindingHeader.vue'
import FindingPanel from '@/components/finding/FindingPanel.vue'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetailResponse>>(),
}))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FindingHeader source access', () => {
  it('shows public, private or unknown source access', () => {
    for (const access of ['public', 'private', 'unknown'] as const) {
      const wrapper = mountWithProviders(FindingHeader, {
        finding: buildFindingView(),
        sourceAccess: access,
      })

      expect(wrapper.get(`[data-access="${access}"]`).text()).toMatch(/source/i)
      wrapper.unmount()
    }
  })

  it('hides the badge without source access', () => {
    const wrapper = mountWithProviders(FindingHeader, { finding: buildFindingView() })

    expect(wrapper.find('.source-access-badge').exists()).toBe(false)
  })

  it('shows the badge in the panel only while the Claude integration is on', async () => {
    vi.mocked(fetchFindingDetail).mockResolvedValue({
      finding: buildFindingView({ id: 1 }),
      instances: [],
      decisions: [],
      events: [],
      kev: null,
      sourceAccess: 'private',
    })
    const { wrapper } = await mountWithRouter(FindingPanel, '/inbox?finding=1')

    await flushPromises()
    expect(wrapper.find('[data-access]').exists()).toBe(false)

    useMcpStore().info = { enabled: true, mcpUrl: 'https://sieb.example.com/mcp', oauth: false }
    await flushPromises()
    expect(wrapper.get('[data-access="private"]').text()).toBe('Private source')
    wrapper.unmount()
  })
})
