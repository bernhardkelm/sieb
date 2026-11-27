import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingView } from '#core/findingView.ts'
import { visibleText } from '@/__tests__/visibleText'
import TriageSelectionBar from '@/components/triage/TriageSelectionBar.vue'
import { useHandoffSelectionStore } from '@/stores/handoffSelectionStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
  createChecks: vi.fn<() => Promise<never>>(),
  cancelCheck: vi.fn<() => Promise<void>>(),
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
let wrapper: VueWrapper | null = null

/**
 * Mounts the bar for checked findings with the Claude integration on.
 * @param {FindingView[]} findings - Checked findings
 * @param {boolean} connected - Whether Claude reaches sieb
 * @returns {VueWrapper} - Bar wrapper
 */
const mountBar = (findings: FindingView[], connected = true): VueWrapper => {
  const pinia = createPinia()

  setActivePinia(pinia)
  useMcpStore().info = {
    enabled: true,
    mcpUrl: null,
    oauth: false,
    claude: { connected, activeTokens: connected ? 1 : 0, oauthLastSeenAt: null },
  }
  useHandoffSelectionStore().register(() => findings)
  wrapper = mount(TriageSelectionBar, {
    props: { count: findings.length },
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  return wrapper
}

/**
 * Returns the bar button with a label.
 * @param {string} label - Button text
 * @returns {HTMLButtonElement | undefined} - Button
 */
const button = (label: string): HTMLButtonElement | undefined =>
  wrapper!
    .findAll<HTMLButtonElement>('button')
    .find((entry) => visibleText(entry.element) === label)?.element

const FOREIGN = [
  buildFindingView({ id: 1, vulnId: 'CVE-2099-1' }),
  buildFindingView({ id: 2, vulnId: 'CVE-2099-2' }),
]
const OWN = [
  buildFindingView({ id: 3, vulnId: 'CVE-2099-3', owner: 'self', imageRef: 'ghcr.io/acme/app:1' }),
  buildFindingView({ id: 4, vulnId: 'CVE-2099-4', owner: 'self', imageRef: 'ghcr.io/acme/app:2' }),
]

beforeEach(() => {
  localStorage.clear()
  writeText.mockReset().mockResolvedValue()
  assign.mockReset()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.stubGlobal('location', { ...window.location, assign })
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyNotice).mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
})

describe('TriageSelectionBar hand-off', () => {
  it('opens the default client and copies the prompt for the selection', async () => {
    mountBar(FOREIGN)

    button('Open in Claude Code')!.click()
    expect(decodeURIComponent(assign.mock.calls[0]![0])).toContain('\n#1 CVE-2099-1 in ')

    button('Copy for Claude')!.click()
    await flushPromises()
    expect(writeText.mock.calls[0]![0]).toMatch(/^Triage these sieb findings/)
    expect(notifySuccess).toHaveBeenCalledWith(
      'Copied prompt for 2 findings',
      'Paste the prompt into Claude.',
    )
    expect(button('Copy claude command')).toBeUndefined()
  })

  it('offers the claude command for own images of one repository', async () => {
    mountBar(OWN)

    button('Copy claude command')!.click()
    await flushPromises()
    expect(writeText.mock.calls[0]![0]).toContain('This repository builds these images')
  })

  it('names the connect step on a blocked open, copying still works', async () => {
    mountBar(OWN, false)
    const open = button('Open in Claude Code')!

    expect(open.getAttribute('aria-disabled')).toBe('true')
    expect(open.title).toMatch(/^Connect Claude first/)
    open.click()
    expect(assign).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledWith('Not handed off', open.title)

    button('Copy for Claude')!.click()
    await flushPromises()
    expect(writeText).toHaveBeenCalledOnce()
  })

  it('shows no open button while copying is the default action', async () => {
    mountBar(FOREIGN)
    useHandoffTargetStore().setPreferred('copy')
    await flushPromises()

    expect(button('Open in Claude Code')).toBeUndefined()
    expect(button('Copy for Claude')).toBeDefined()
  })
})
