import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { fetchHealth } from '@/api/healthApi'
import { fetchMe } from '@/api/meApi'
import { fetchSyncStatus, triggerSync } from '@/api/syncApi'
import { createToken, fetchMcpInfo, fetchTokens, revokeToken } from '@/api/tokensApi'
import AppTopBar from '@/components/layout/AppTopBar.vue'

vi.mock('@/api/meApi', () => ({ fetchMe: vi.fn<typeof fetchMe>() }))
vi.mock('@/api/healthApi', () => ({ fetchHealth: vi.fn<typeof fetchHealth>() }))
vi.mock('@/api/syncApi', () => ({
  fetchSyncStatus: vi.fn<typeof fetchSyncStatus>(),
  triggerSync: vi.fn<typeof triggerSync>(),
}))
vi.mock('@/api/tokensApi', () => ({
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
  fetchTokens: vi.fn<typeof fetchTokens>(),
  createToken: vi.fn<typeof createToken>(),
  revokeToken: vi.fn<typeof revokeToken>(),
}))

let mounted: RoutedMount | null = null

/**
 * Mounts the top bar on the inbox route.
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountTopBar = async (): Promise<RoutedMount> => {
  mounted = await mountWithRouter(AppTopBar, '/inbox')
  await flushPromises()

  return mounted
}

beforeEach(() => {
  vi.mocked(fetchMe).mockResolvedValue({ username: 'alice', authMode: 'header' })
  vi.mocked(fetchHealth).mockRejectedValue(new Error('offline'))
  vi.mocked(fetchSyncStatus).mockRejectedValue(new Error('offline'))
  vi.mocked(fetchTokens).mockResolvedValue([])
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('AppTopBar user', () => {
  it('shows the username as plain text while the Claude integration is off', async () => {
    vi.mocked(fetchMcpInfo).mockResolvedValue({
      enabled: false,
      mcpUrl: null,
      oauth: false,
      claude: null,
    })
    const { wrapper } = await mountTopBar()

    expect(wrapper.get('.user').element.tagName).toBe('SPAN')
    expect(wrapper.get('.user').text()).toBe('alice')
    expect(wrapper.find('.tokens-button').exists()).toBe(false)
  })

  it('opens the token dialog from the user menu while the integration is on', async () => {
    vi.mocked(fetchMcpInfo).mockResolvedValue({
      enabled: true,
      mcpUrl: 'https://sieb.example.com/mcp',
      oauth: false,
      claude: null,
    })
    const { wrapper } = await mountTopBar()
    const trigger = wrapper.get('.trigger')

    expect(wrapper.find('span.user').exists()).toBe(false)
    expect(trigger.text()).toBe('User menu of alice')

    await trigger.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const items = [...document.body.querySelectorAll('[role="menuitem"]')]

    expect(items.map((item) => item.textContent?.trim())).toEqual(['API tokens…'])

    items[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('API tokens')
    expect(fetchTokens).toHaveBeenCalledOnce()
  })
})
