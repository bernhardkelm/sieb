import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountWithProviders } from '@/__tests__/mountWithProviders'
import HandoffButton from '@/components/finding/HandoffButton.vue'
import { HANDOFF_TARGET_STORAGE_KEY, useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyWithAction } from '@/toast/toastManager'

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: unknown) => void>(),
}))

const REASON =
  'Connect Claude first: add the sieb connector in claude.ai or create an API token (your name in the top bar, API tokens).'

const PROMPTS = { chat: 'Chat it', code: 'Triage it' }

const writeText = vi.fn<(text: string) => Promise<void>>()
const assign = vi.fn<(url: string) => void>()

/**
 * Joins the text nodes of an element with spaces, so label, help line and keys stay apart.
 * @param {HTMLElement} element - Element
 * @returns {string} - Text
 */
const spacedText = (element: HTMLElement): string => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const parts: string[] = []

  while (walker.nextNode()) {
    parts.push(walker.currentNode.textContent?.trim() ?? '')
  }

  return parts.filter((part) => part !== '').join(' ')
}

/**
 * Returns the visible text of the menu items rendered into the body portal, help lines included.
 * @returns {string[]} - Item texts
 */
const menuTexts = (): string[] =>
  [...document.body.querySelectorAll<HTMLElement>('[role^="menuitem"]')].map(spacedText)

/**
 * Returns the menu item whose text starts with a label.
 * @param {string} label - Start of the item text
 * @returns {HTMLElement} - Item
 */
const menuItem = (label: string): HTMLElement => {
  const item = [...document.body.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    (candidate) => candidate.textContent?.trim().startsWith(label),
  )

  if (!item) {
    throw new Error(`No menu item ${label}`)
  }

  return item
}

/**
 * Mounts the button with the given Claude connection state.
 * @param {string | null} command - claude command, null for images of others
 * @param {boolean} connected - Whether Claude reaches sieb for the user
 * @returns {VueWrapper} - Wrapper
 */
const mountButton = (command: string | null, connected = true): VueWrapper => {
  const wrapper = mountWithProviders(HandoffButton, { prompts: PROMPTS, command })

  useMcpStore().info = {
    enabled: true,
    mcpUrl: 'https://sieb.example.com/mcp',
    oauth: true,
    claude: { connected, activeTokens: connected ? 1 : 0, oauthLastSeenAt: null },
  }

  return wrapper
}

/**
 * Mounts the button and opens its chevron menu.
 * @param {string | null} command - claude command, null for images of others
 * @param {boolean} connected - Whether Claude reaches sieb for the user
 * @returns {Promise<VueWrapper>} - Wrapper
 */
const openMenu = async (command: string | null, connected = true): Promise<VueWrapper> => {
  const wrapper = mountButton(command, connected)

  await flushPromises()

  await wrapper.get('[aria-haspopup="menu"]').trigger('keydown', { key: 'Enter' })
  await flushPromises()

  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  writeText.mockReset().mockResolvedValue()
  assign.mockReset()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('location', { ...window.location, assign })
  vi.mocked(notifyWithAction).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('HandoffButton', () => {
  it('opens Claude Code desktop by default and offers copying in a toast', async () => {
    const wrapper = mountButton(null)
    await flushPromises()
    const primary = wrapper.get('button.primary')

    expect(primary.text()).toBe('Open in Claude Code')
    expect(primary.attributes('aria-keyshortcuts')).toBe('Shift+H')
    expect(wrapper.get('[aria-haspopup="menu"]').attributes('aria-label')).toBe(
      'More ways to hand off to Claude',
    )

    await primary.trigger('click')

    expect(assign).toHaveBeenCalledWith('claude://code/new?q=Triage%20it')
    expect(notifyWithAction).toHaveBeenCalledOnce()
    expect(writeText).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['desktop-chat', 'Open in Claude chat', 'claude://claude.ai/new?q=Chat%20it'],
    ['cli', 'Open in terminal', 'claude-cli://open?q=Triage%20it'],
    ['vscode', 'Open in VS Code', 'vscode://anthropic.claude-code/open?prompt=Triage%20it'],
  ])('follows the stored default %s', async (target, label, link) => {
    localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, target)
    const wrapper = mountButton(null)

    expect(wrapper.get('button.primary').text()).toBe(label)

    await wrapper.get('button.primary').trigger('click')

    expect(assign).toHaveBeenCalledWith(link)
    wrapper.unmount()
  })

  it('copies with the check icon when copy is the default', async () => {
    localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, 'copy')
    const wrapper = mountButton(null)
    await flushPromises()
    const primary = wrapper.get('button.primary')

    expect(primary.text()).toBe('Copy for Claude')

    await primary.trigger('click')
    await flushPromises()

    expect(assign).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('Chat it')
    expect(primary.classes()).toContain('copied')
    expect(wrapper.get('[role="status"]').text()).toBe('Copied')
    wrapper.unmount()
  })

  it('lists the targets with help and the prompt copy for images of others', async () => {
    const wrapper = await openMenu(null)

    expect(menuTexts()).toEqual([
      'Claude Code (desktop) Needs the Claude desktop app ⇧ H',
      'Claude chat (desktop) Needs the sieb connector in Claude',
      'Claude Code in terminal Needs Claude Code run once in a terminal',
      'VS Code Needs the Claude Code VS Code extension',
      'Copy prompt h',
      'Default action Open in Claude Code, ⇧H',
    ])

    const help = document.getElementById(menuItem('VS Code').getAttribute('aria-describedby')!)

    expect(help?.textContent).toBe('Needs the Claude Code VS Code extension')

    menuItem('Claude Code in terminal').click()
    await flushPromises()

    expect(assign).toHaveBeenCalledWith('claude-cli://open?q=Triage%20it')
    expect(menuTexts()).toHaveLength(0)
    wrapper.unmount()
  })

  it('adds the claude command for own images', async () => {
    const wrapper = await openMenu("claude 'Triage it'")

    expect(menuTexts()).toContain('Copy claude command y')

    menuItem('Copy claude command').click()
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith("claude 'Triage it'")
    expect(assign).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('sets the default action from the submenu', async () => {
    const wrapper = await openMenu(null)

    menuItem('Default action').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    await flushPromises()

    const radios = [...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]

    expect(radios.map((radio) => radio.textContent?.trim())).toEqual([
      'Claude Code (desktop)',
      'Claude chat (desktop)',
      'Claude Code in terminal',
      'VS Code',
      'Copy prompt',
    ])
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true')

    radios[3]!.click()
    await flushPromises()

    expect(useHandoffTargetStore().preferred).toBe('vscode')
    expect(localStorage.getItem(HANDOFF_TARGET_STORAGE_KEY)).toBe('vscode')
    expect(wrapper.get('button.primary').text()).toBe('Open in VS Code')
    wrapper.unmount()
  })

  it('disables the deep links and the command with the reason until Claude is connected', async () => {
    const wrapper = await openMenu("claude 'Triage it'", false)
    const primary = wrapper.get('button.primary')
    const note = document.body.querySelector<HTMLElement>('.note')
    const content = document.body.querySelector<HTMLElement>('[role="menu"]')

    expect(primary.attributes('aria-disabled')).toBe('true')
    expect(primary.attributes('tabindex')).toBe('-1')
    expect(primary.attributes('title')).toBe(REASON)
    expect(note?.textContent?.trim()).toBe(REASON)
    expect(content?.getAttribute('aria-describedby')).toBe(note?.id)

    for (const label of ['Claude Code (desktop)', 'VS Code', 'Copy claude command']) {
      const item = menuItem(label)

      expect(item.getAttribute('aria-disabled')).toBe('true')
      expect(item.getAttribute('title')).toBe(REASON)
      expect(item.getAttribute('aria-describedby')?.split(' ')[0]).toBe(note?.id)
    }

    menuItem('VS Code').click()
    menuItem('Copy claude command').click()
    await primary.trigger('click')
    await flushPromises()

    expect(assign).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()

    const copyPrompt = menuItem('Copy prompt')

    expect(copyPrompt.getAttribute('aria-disabled')).toBeNull()
    expect(copyPrompt.getAttribute('title')).toBeNull()

    copyPrompt.click()
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('Chat it')
    wrapper.unmount()
  })

  it('names only the token without OAuth and keeps a copy default enabled', async () => {
    localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, 'copy')
    const wrapper = mountButton(null, false)

    useMcpStore().info = { ...useMcpStore().info!, oauth: false }
    await flushPromises()

    const primary = wrapper.get('button.primary')

    expect(primary.attributes('aria-disabled')).toBeUndefined()
    expect(primary.attributes('title')).toBe('Copy for Claude (Shift+H)')
    expect(useMcpStore().connectReason).toBe(
      'Connect Claude first: create an API token (your name in the top bar, API tokens).',
    )

    await primary.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('Chat it')
    wrapper.unmount()
  })

  it('enables the deep links once Claude is connected', async () => {
    const wrapper = mountButton(null, false)

    await flushPromises()
    expect(wrapper.get('button.primary').attributes('aria-disabled')).toBe('true')

    useMcpStore().info = {
      ...useMcpStore().info!,
      claude: { connected: true, activeTokens: 1, oauthLastSeenAt: null },
    }
    await flushPromises()

    expect(wrapper.get('button.primary').attributes('aria-disabled')).toBeUndefined()

    await wrapper.get('button.primary').trigger('click')

    expect(assign).toHaveBeenCalledWith('claude://code/new?q=Triage%20it')
    wrapper.unmount()
  })
})
