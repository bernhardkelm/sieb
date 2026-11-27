import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetail } from '#core/findingView.ts'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetail>>(),
}))

vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
  notifyWithAction:
    vi.fn<(id: string, title: string, description: string, action: unknown) => void>(),
}))

const writeText = vi.fn<(text: string) => Promise<void>>()
const assign = vi.fn<(url: string) => void>()
let mounted: RoutedMount | null = null

/**
 * Opens the panel of finding 1 with the given owner.
 * @param {string | null} owner - Owner label of the image
 * @param {boolean} enabled - Whether the Claude integration is on
 * @param {boolean} connected - Whether Claude reaches sieb for the user
 * @returns {Promise<HTMLElement>} - Panel element
 */
const openPanel = async (
  owner: string | null,
  enabled = true,
  connected = true,
): Promise<HTMLElement> => {
  vi.mocked(fetchFindingDetail).mockResolvedValue({
    finding: buildFindingView({ id: 1, owner }),
    instances: [],
    decisions: [],
    events: [],
    kev: null,
    sourceAccess: 'private',
  })
  mounted = await mountWithRouter(FindingPanel, '/inbox?finding=1')
  useMcpStore().info = enabled
    ? {
        enabled: true,
        mcpUrl: 'https://sieb.example.com/mcp',
        oauth: true,
        claude: { connected, activeTokens: connected ? 1 : 0, oauthLastSeenAt: null },
      }
    : { enabled: false, mcpUrl: null, oauth: false, claude: null }
  await flushPromises()

  return mounted.wrapper.get<HTMLElement>('.finding-panel').element
}

/**
 * Presses a key on an element and waits for the copy.
 * @param {HTMLElement} target - Focused element
 * @param {string} key - KeyboardEvent key
 * @param {Partial<KeyboardEventInit>} init - Further event fields
 * @returns {Promise<void>}
 */
const press = async (
  target: HTMLElement,
  key: string,
  init: Partial<KeyboardEventInit> = {},
): Promise<void> => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  writeText.mockReset().mockResolvedValue()
  assign.mockReset()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('location', { ...window.location, assign })
  vi.mocked(notifySuccess).mockClear()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('FindingPanel hand-off keys', () => {
  it('copies the chat prompt on h, without the repository sentence of Claude Code', async () => {
    const panel = await openPanel('self')

    await press(panel, 'h')

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]![0]).toMatch(/^Triage sieb finding #1: /)
    expect(writeText.mock.calls[0]![0]).not.toContain('working directory')
    expect(notifySuccess).toHaveBeenCalledWith('Copied for Claude', 'Paste the prompt into Claude.')
  })

  it('opens Claude Code with the repository sentence for own images, the chat without', async () => {
    const panel = await openPanel('self')

    await press(panel, 'H', { shiftKey: true })
    expect(decodeURIComponent(assign.mock.calls[0]![0])).toContain(
      'Own image: check the code in the working directory',
    )

    useHandoffTargetStore().setPreferred('desktop-chat')
    await press(panel, 'H', { shiftKey: true })
    expect(assign.mock.calls[1]![0]).toMatch(/^claude:\/\/claude\.ai\/new\?q=/)
    expect(decodeURIComponent(assign.mock.calls[1]![0])).not.toContain('working directory')
  })

  it('copies the claude command on y for own images only', async () => {
    const panel = await openPanel('third-party')

    await press(panel, 'y')
    expect(writeText).not.toHaveBeenCalled()
    expect(useHintActionsStore().reasonOf('handoffCommand')).toBe('Only for own images')
    mounted?.wrapper.unmount()

    const own = await openPanel('self')

    await press(own, 'y')
    expect(writeText.mock.calls[0]![0]).toMatch(
      /^claude 'Triage sieb finding #1: .*This repository builds/,
    )
    expect(useHintActionsStore().reasonOf('handoffCommand')).toBeNull()
  })

  it('opens the default target on Shift+H, not on Caps Lock H', async () => {
    const panel = await openPanel('third-party')

    await press(panel, 'H')
    expect(assign).not.toHaveBeenCalled()

    await press(panel, 'H', { shiftKey: true })
    expect(assign).toHaveBeenCalledOnce()
    expect(assign.mock.calls[0]![0]).toMatch(
      /^claude:\/\/code\/new\?q=Triage%20sieb%20finding%20%231%3A/,
    )
    expect(writeText).not.toHaveBeenCalled()

    useHandoffTargetStore().setPreferred('copy')
    await press(panel, 'H', { shiftKey: true })

    expect(assign).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]![0]).toMatch(/^Triage sieb finding #1: /)
  })

  it('closes only the menu on Escape, the panel stays open', async () => {
    const panel = await openPanel('self')
    const trigger = panel.querySelector<HTMLElement>('[aria-haspopup="menu"]')!

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    const item = document.body.querySelector<HTMLElement>('[role="menuitem"]')!

    item.focus()
    await press(item, 'Escape')

    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    expect(mounted!.wrapper.find('.finding-panel').exists()).toBe(true)
    expect(mounted!.router.currentRoute.value.query.finding).toBe('1')
  })

  it('ignores the keys with modifiers, in text entries and in dialogs', async () => {
    const panel = await openPanel('self')
    const input = document.createElement('input')
    const dialog = document.createElement('div')
    const inDialog = document.createElement('button')

    dialog.setAttribute('role', 'dialog')
    dialog.append(inDialog)
    panel.append(input, dialog)

    await press(panel, 'h', { metaKey: true })
    await press(input, 'h')
    await press(inDialog, 'y')

    expect(writeText).not.toHaveBeenCalled()
  })

  it('runs the hint actions and blocks them without an open finding', async () => {
    await openPanel('self')
    const hints = useHintActionsStore()

    expect(await hints.run('handoff', false)).toBe(true)
    expect(writeText).toHaveBeenCalledOnce()
    expect(await hints.run('handoffOpen', false)).toBe(true)
    expect(assign).toHaveBeenCalledOnce()

    await mounted!.router.push('/inbox')
    await flushPromises()

    expect(hints.reasonOf('handoffOpen')).toBe('Open a finding first')
    expect(hints.reasonOf('handoff')).toBe('Open a finding first')
    expect(hints.reasonOf('handoffCommand')).toBe('Open a finding first')
  })

  it('shows no button and ignores h and y while the integration is off', async () => {
    const panel = await openPanel('self', false)

    expect(panel.querySelector('.handoff-button')).toBeNull()

    const pressed = new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true })

    panel.dispatchEvent(pressed)
    await press(panel, 'y')
    await press(panel, 'H', { shiftKey: true })

    expect(pressed.defaultPrevented).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it('blocks Shift+H with a deep link and y until Claude is connected, h still copies', async () => {
    const panel = await openPanel('self', true, false)
    const hints = useHintActionsStore()
    const reason =
      'Connect Claude first: add the sieb connector in claude.ai or create an API token (your name in the top bar, API tokens).'

    await press(panel, 'y')
    await press(panel, 'H', { shiftKey: true })

    expect(writeText).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
    expect(hints.reasonOf('handoffCommand')).toBe(reason)
    expect(hints.reasonOf('handoffOpen')).toBe(reason)
    expect(hints.reasonOf('handoff')).toBeNull()

    await press(panel, 'h')

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]![0]).toMatch(/^Triage sieb finding #1: /)

    useHandoffTargetStore().setPreferred('copy')
    await press(panel, 'H', { shiftKey: true })

    expect(hints.reasonOf('handoffOpen')).toBeNull()
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(assign).not.toHaveBeenCalled()
  })

  it('shows the button once the integration is on', async () => {
    const panel = await openPanel('third-party')

    expect(panel.querySelector('.handoff-button')?.textContent).toContain('Open in Claude Code')
  })
})
