import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchFindings, markFindingsSeen } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useHandoffHintActions } from '@/composables/useHandoffHintActions'
import { useTriageController, type TriageController } from '@/composables/useTriageController'
import { NO_FINDING_REASON } from '@/composables/useHandoff'
import { useFindingSeenStore } from '@/stores/findingSeenStore'
import { useHandoffTargetStore } from '@/stores/handoffTargetStore'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyNotice, notifySuccess, notifyWithAction } from '@/toast/toastManager'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
  markFindingsSeen: vi.fn<typeof markFindingsSeen>(async () => ({ ignored: [] })),
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
let controller: TriageController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    useHandoffHintActions()
    controller = useTriageController(() => {})

    return () => h('div', { 'data-shortcut-scope': 'panel', id: 'panel' })
  },
})

/**
 * Mounts the triage host with findings and the Claude integration on.
 * @param {number} count - Listed findings
 * @param {boolean} connected - Whether Claude reaches sieb
 * @returns {Promise<void>}
 */
const mountTriage = async (count: number, connected = true): Promise<void> => {
  vi.mocked(fetchFindings).mockResolvedValue(
    Array.from({ length: count }, (_, index) =>
      buildFindingView({
        id: index + 1,
        vulnId: `CVE-2099-${10_000 + index}`,
        imageRef: `index.docker.io/library/image-${index}:1.2.3`,
      }),
    ),
  )
  mounted = await mountWithRouter(Host, '/triage')
  useMcpStore().info = {
    enabled: true,
    mcpUrl: null,
    oauth: false,
    claude: { connected, activeTokens: connected ? 1 : 0, oauthLastSeenAt: null },
  }
  await flushPromises()
}

/**
 * Presses a key on an element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @param {Element} target - Focused element
 * @param {KeyboardEventInit} init - Modifiers
 * @returns {Promise<void>}
 */
const press = async (
  key: string,
  target: Element = document.body,
  init: KeyboardEventInit = {},
): Promise<void> => {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
  await flushPromises()
}

/**
 * Checks the first rows of the list.
 * @param {number} count - Rows to check
 * @returns {Promise<void>}
 */
const check = async (count: number): Promise<void> => {
  for (let id = 1; id <= count; id += 1) {
    controller.toggleChecked(id)
  }

  await flushPromises()
}

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
  mounted?.wrapper.unmount()
  mounted = null
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('selection hand-off keys', () => {
  it('copies one prompt for the checked rows on h and keeps the selection', async () => {
    await mountTriage(6)
    await check(5)
    await press('h')

    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]![0]).toMatch(
      /^Triage these sieb findings, one proposal each:\n#1 /,
    )
    expect(writeText.mock.calls[0]![0]).toContain('\n#5 CVE-2099-10004 in ')
    expect(notifySuccess).toHaveBeenCalledWith(
      'Copied prompt for 5 findings',
      'Paste the prompt into Claude.',
    )
    expect(controller.checkedIds.value.size).toBe(5)
  })

  it('marks the checked findings seen on copy and on open', async () => {
    await mountTriage(3)
    const seen = vi.spyOn(useFindingSeenStore(), 'markSeen')

    await check(2)
    await press('h')
    expect(seen).toHaveBeenLastCalledWith([1, 2])

    seen.mockClear()
    await press('H', document.body, { shiftKey: true })
    expect(seen).toHaveBeenCalledWith([1, 2])
  })

  it('opens the default client with the whole selection on Shift+H', async () => {
    await mountTriage(3)
    await check(3)
    await press('H', document.body, { shiftKey: true })

    expect(assign).toHaveBeenCalledOnce()
    expect(decodeURIComponent(assign.mock.calls[0]![0])).toMatch(
      /^claude:\/\/code\/new\?q=Triage these sieb findings.*\n#3 /su,
    )
    expect(notifyWithAction).toHaveBeenCalledWith(
      'handoff-open',
      'Opening Claude with 3 findings…',
      'If nothing happens, copy the prompt instead.',
      expect.anything(),
    )
  })

  it('names the reason instead of opening a selection too long for a link', async () => {
    await mountTriage(45)
    await check(45)
    await press('H', document.body, { shiftKey: true })

    expect(assign).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledWith(
      'Not handed off',
      expect.stringMatching(/^Too many findings for a link \(\d+ max\), copy the prompt instead$/),
    )

    await press('h')
    expect(writeText.mock.calls[0]![0].split('\n')).toHaveLength(47)
  })

  it('blocks links and the command without a connection, copying still works', async () => {
    await mountTriage(3, false)
    await check(2)
    await press('H', document.body, { shiftKey: true })
    await press('y')

    expect(assign).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledTimes(2)

    await press('h')
    expect(writeText).toHaveBeenCalledOnce()
  })

  it('leaves the keys in the panel to the panel finding', async () => {
    await mountTriage(3)
    await check(2)
    await press('h', document.getElementById('panel')!)

    expect(writeText).not.toHaveBeenCalled()
  })

  it('does nothing on the page without checked rows', async () => {
    await mountTriage(3)
    await press('h')

    expect(writeText).not.toHaveBeenCalled()
    expect(notifyNotice).not.toHaveBeenCalled()
  })
})

describe('selection hand-off hints', () => {
  it('act on the selection while rows are checked, else on the panel finding', async () => {
    await mountTriage(3)
    const hints = useHintActionsStore()

    expect(hints.reasonOf('handoff')).toBe(NO_FINDING_REASON)

    await check(2)
    expect(hints.reasonOf('handoff')).toBeNull()
    expect(hints.reasonOf('handoffCommand')).toBe('Only for own images of one repository')
    expect(await hints.run('handoff', false)).toBe(true)
    await flushPromises()
    expect(writeText.mock.calls[0]![0]).toMatch(/^Triage these sieb findings/)

    controller.clearChecked()
    await flushPromises()
    expect(hints.reasonOf('handoff')).toBe(NO_FINDING_REASON)
  })

  it('copy the prompt for the copy default without a connection', async () => {
    await mountTriage(3, false)
    useHandoffTargetStore().setPreferred('copy')
    await check(2)

    expect(useHintActionsStore().reasonOf('handoffOpen')).toBeNull()
    expect(await useHintActionsStore().run('handoffOpen', false)).toBe(true)
    await flushPromises()
    expect(writeText).toHaveBeenCalledOnce()
    expect(assign).not.toHaveBeenCalled()
  })
})
