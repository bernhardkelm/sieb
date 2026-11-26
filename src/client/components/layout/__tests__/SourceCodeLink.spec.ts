import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { fetchHealth } from '@/api/healthApi'
import { fetchMe } from '@/api/meApi'
import SourceCodeLink from '@/components/layout/SourceCodeLink.vue'
import { useMeStore } from '@/stores/meStore'

vi.mock('@/api/meApi', () => ({ fetchMe: vi.fn<typeof fetchMe>() }))
vi.mock('@/api/healthApi', () => ({ fetchHealth: vi.fn<typeof fetchHealth>() }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SourceCodeLink', () => {
  it('shows the running version next to a link to its source code', async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      username: 'alice',
      authMode: 'header',
      version: '0.2.1',
      sourceCodeUrl: 'https://github.com/bernhardkelm/sieb/tree/0.2.1',
    })
    vi.mocked(fetchHealth).mockRejectedValue(new Error('offline'))
    const wrapper = mountWithProviders(SourceCodeLink, {})

    expect(wrapper.find('a').exists()).toBe(false)

    await useMeStore().load()
    await flushPromises()
    const link = wrapper.get('a')

    expect(wrapper.text()).toMatch(/^sieb 0\.2\.1\s*·\s*Source/)
    expect(link.attributes()).toMatchObject({
      href: 'https://github.com/bernhardkelm/sieb/tree/0.2.1',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(link.text()).toBe('Source code of this version, opens in a new tab')
    expect(wrapper.get('[aria-hidden="true"]').text()).toBe('·')
  })

  it('renders nothing while the server did not name a link', async () => {
    vi.mocked(fetchMe).mockRejectedValue(new Error('offline'))
    vi.mocked(fetchHealth).mockRejectedValue(new Error('offline'))
    const wrapper = mountWithProviders(SourceCodeLink, {})

    await useMeStore().load()
    await flushPromises()

    expect(wrapper.find('.source-code-link').exists()).toBe(false)
  })
})
