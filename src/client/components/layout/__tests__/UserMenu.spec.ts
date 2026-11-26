import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logout } from '@/api/authApi'
import { createToken, fetchMcpInfo, fetchTokens, revokeToken } from '@/api/tokensApi'
import UserMenu from '@/components/layout/UserMenu.vue'
import { useMcpStore } from '@/stores/mcpStore'
import { useMeStore } from '@/stores/meStore'

vi.mock('@/api/authApi', () => ({ logout: vi.fn<typeof logout>() }))
vi.mock('@/api/tokensApi', () => ({
  fetchMcpInfo: vi.fn<typeof fetchMcpInfo>(),
  fetchTokens: vi.fn<typeof fetchTokens>().mockResolvedValue([]),
  createToken: vi.fn<typeof createToken>(),
  revokeToken: vi.fn<typeof revokeToken>(),
}))

const assign = vi.fn<(url: string) => void>()
let wrapper: VueWrapper | null = null

/**
 * Mounts the menu with the given auth mode and MCP state.
 * @param {'header' | 'oidc'} authMode - Reported auth mode
 * @param {boolean} mcpEnabled - Whether the Claude integration is on
 * @returns {Promise<VueWrapper>} - Mounted wrapper
 */
const mountMenu = async (authMode: 'header' | 'oidc', mcpEnabled: boolean): Promise<VueWrapper> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.mocked(fetchMcpInfo).mockResolvedValue({
    enabled: mcpEnabled,
    mcpUrl: null,
    oauth: false,
    claude: null,
  })
  const me = useMeStore()
  me.username = 'alice'
  me.authMode = authMode
  await useMcpStore().load()
  wrapper = mount(UserMenu, { global: { plugins: [pinia] }, attachTo: document.body })

  return wrapper
}

/**
 * Opens the menu and returns the item labels.
 * @param {VueWrapper} menu - Mounted menu
 * @returns {Promise<string[]>} - Item labels
 */
const openItems = async (menu: VueWrapper): Promise<string[]> => {
  await menu.get('.trigger').trigger('keydown', { key: 'Enter' })
  await flushPromises()

  return [...document.body.querySelectorAll('[role="menuitem"]')].map(
    (item) => item.textContent?.trim() ?? '',
  )
}

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, assign })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('UserMenu', () => {
  it('stays plain text in header mode without MCP', async () => {
    const menu = await mountMenu('header', false)

    expect(menu.find('.trigger').exists()).toBe(false)
    expect(menu.get('.user').text()).toBe('alice')
  })

  it.each([
    ['header', true, ['API tokens…']],
    ['oidc', false, ['Log out']],
    ['oidc', true, ['API tokens…', 'Log out']],
  ] as const)('lists the items for %s with MCP %s', async (mode, mcp, expected) => {
    const menu = await mountMenu(mode, mcp)

    expect(await openItems(menu)).toEqual(expected)
  })

  it('logs out and navigates to the returned redirect', async () => {
    vi.mocked(logout).mockResolvedValue('https://idp.example.com/end')
    const menu = await mountMenu('oidc', false)
    await openItems(menu)

    document.body.querySelector<HTMLElement>('[role="menuitem"]')!.click()
    await flushPromises()

    expect(logout).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith('https://idp.example.com/end')
  })
})
