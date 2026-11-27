import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetailResponse } from '#core/findingApiTypes.ts'
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

describe('FindingHeader image access', () => {
  it.each([
    [
      'own and public',
      { imageVisibility: 'public', ownership: 'own' },
      ['Own image', 'Public image'],
    ],
    [
      'own with a credential',
      { imageVisibility: 'credential', ownership: 'own' },
      ['Own image', 'Needs a credential'],
    ],
    [
      'third-party and restricted',
      { imageVisibility: 'restricted', ownership: 'third_party' },
      ['Not pullable'],
    ],
    ['third-party and public', { imageVisibility: 'public', ownership: 'third_party' }, []],
    ['own and unknown', { imageVisibility: 'unknown', ownership: 'own' }, ['Own image']],
    ['third-party and unknown', { imageVisibility: 'unknown', ownership: 'third_party' }, []],
  ] as const)('shows the chips of an image %s', (_, access, labels) => {
    const wrapper = mountWithProviders(FindingHeader, { finding: buildFindingView(), access })

    expect(wrapper.findAll('.image-access-chip').map((chip) => chip.text())).toEqual(labels)
    wrapper.unmount()
  })

  it('marks the chips with their fact', () => {
    const wrapper = mountWithProviders(FindingHeader, {
      finding: buildFindingView(),
      access: { imageVisibility: 'restricted', ownership: 'own' },
    })

    expect(wrapper.get('[data-ownership="own"]').text()).toBe('Own image')
    expect(wrapper.get('[data-visibility="restricted"]').attributes('tabindex')).toBe('0')
  })

  it('hides the chips without access facts', () => {
    const wrapper = mountWithProviders(FindingHeader, { finding: buildFindingView() })

    expect(wrapper.find('.image-access-chip').exists()).toBe(false)
  })

  it('shows the chips in the panel only while the Claude integration is on', async () => {
    vi.mocked(fetchFindingDetail).mockResolvedValue({
      finding: buildFindingView({ id: 1 }),
      instances: [],
      decisions: [],
      events: [],
      kev: null,
      imageVisibility: 'unknown',
      ownership: 'own',
    })
    const { wrapper } = await mountWithRouter(FindingPanel, '/inbox?finding=1')

    await flushPromises()
    expect(wrapper.find('[data-ownership]').exists()).toBe(false)

    useMcpStore().info = {
      enabled: true,
      mcpUrl: 'https://sieb.example.com/mcp',
      oauth: false,
      claude: null,
    }
    await flushPromises()
    expect(wrapper.get('[data-ownership="own"]').text()).toBe('Own image')
    wrapper.unmount()
  })
})
