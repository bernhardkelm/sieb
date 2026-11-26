import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountWithProviders } from '@/__tests__/mountWithProviders'
import HandoffButton from '@/components/finding/HandoffButton.vue'
import { HANDOFF_TARGET_STORAGE_KEY, useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { notifyWithAction } from '@/toast/toastManager'

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: unknown) => void>(),
}))

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
 * Mounts the button and opens its chevron menu.
 * @param {string | null} command - claude command, null for images of others
 * @returns {Promise<VueWrapper>} - Wrapper
 */
const openMenu = async (command: string | null): Promise<VueWrapper> => {
  const wrapper = mountWithProviders(HandoffButton, { prompt: 'Triage it', command })

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
    const wrapper = mountWithProviders(HandoffButton, { prompt: 'Triage it', command: null })
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
    ['desktop-chat', 'Open in Claude chat', 'claude://claude.ai/new?q=Triage%20it'],
    ['cli', 'Open in terminal', 'claude-cli://open?q=Triage%20it'],
    ['vscode', 'Open in VS Code', 'vscode://anthropic.claude-code/open?prompt=Triage%20it'],
  ])('follows the stored default %s', async (target, label, link) => {
    localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, target)
    const wrapper = mountWithProviders(HandoffButton, { prompt: 'Triage it', command: null })

    expect(wrapper.get('button.primary').text()).toBe(label)

    await wrapper.get('button.primary').trigger('click')

    expect(assign).toHaveBeenCalledWith(link)
    wrapper.unmount()
  })

  it('copies with the check icon when copy is the default', async () => {
    localStorage.setItem(HANDOFF_TARGET_STORAGE_KEY, 'copy')
    const wrapper = mountWithProviders(HandoffButton, { prompt: 'Triage it', command: null })
    const primary = wrapper.get('button.primary')

    expect(primary.text()).toBe('Copy for Claude')

    await primary.trigger('click')
    await flushPromises()

    expect(assign).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('Triage it')
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
})
