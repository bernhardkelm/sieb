import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { CheckCreateResponse, CheckView, ChecksResponse } from '#core/check.ts'
import { MAX_OPEN_CHECKS } from '#core/checkLimits.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { createChecks } from '@/api/checksApi'
import { fetchFindings } from '@/api/findingsApi'
import { useAutoCheckHintActions } from '@/composables/useAutoCheckHintActions'
import { NO_FINDING_REASON } from '@/composables/useHandoff'
import { useTriageController, type TriageController } from '@/composables/useTriageController'
import { FINDING_NOUN } from '@/format/bulkCount'
import { OPEN_SKIP_REASON, WORKER_OFFLINE_REASON } from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'
import { useHintActionsStore } from '@/stores/hintActionsStore'
import { useMcpStore } from '@/stores/mcpStore'
import { notifyNotice } from '@/toast/toastManager'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(() => new Promise(() => {})),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

/**
 * Builds queued checks of findings outside the list.
 * @param {number} count - Queued checks
 * @returns {CheckView[]} - Checks in queue order
 */
const queuedChecks = (count: number): CheckView[] =>
  Array.from({ length: count }, (_, index) =>
    buildCheck({ id: 1000 + index, findingId: 1000 + index, position: index + 1 }),
  )

let controller: TriageController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    useAutoCheckHintActions()
    controller = useTriageController(() => {})

    return () => h('div', { 'data-shortcut-scope': 'panel', id: 'panel' })
  },
})

/**
 * Mounts the triage host with four findings, the Claude integration and Auto-check on.
 * @param {ChecksResponse} checks - Checks answer
 * @returns {Promise<void>}
 */
const mountTriage = async (checks: ChecksResponse = buildChecksResponse()): Promise<void> => {
  vi.mocked(fetchFindings).mockResolvedValue(
    [1, 2, 3, 4].map((id) => buildFindingView({ id, vulnId: `CVE-2099-${id}` })),
  )
  mounted = await mountWithRouter(Host, '/triage')
  useMcpStore().info = { enabled: true, mcpUrl: null, oauth: false, claude: null }
  useChecksStore().response = checks
  await flushPromises()
}

/**
 * Presses a key on an element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @param {Element} target - Focused element
 * @param {boolean} shiftKey - Whether Shift is held
 * @returns {Promise<void>}
 */
const press = async (
  key: string,
  target: Element = document.body,
  shiftKey = true,
): Promise<void> => {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
  )
  await flushPromises()
}

/**
 * Checks rows of the list.
 * @param {number[]} ids - Finding ids to check
 * @returns {Promise<void>}
 */
const check = async (ids: number[]): Promise<void> => {
  for (const id of ids) {
    controller.toggleChecked(id)
  }

  await flushPromises()
}

beforeEach(() => {
  vi.mocked(createChecks)
    .mockReset()
    .mockResolvedValue({ queued: [buildCheck({ position: null })], skipped: [] })
  vi.mocked(notifyNotice).mockClear()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('selection Auto-check', () => {
  it('queues the checked rows on Shift+C on the page', async () => {
    await mountTriage()
    await check([2, 3])

    await press('C', document.body, false)
    expect(createChecks).not.toHaveBeenCalled()

    await press('C')
    expect(createChecks).toHaveBeenCalledExactlyOnceWith([2, 3])
  })

  it('leaves Shift+C to the panel inside it and does nothing without checked rows', async () => {
    await mountTriage()

    await press('C')
    await check([1])
    await press('C', document.getElementById('panel')!)

    expect(createChecks).not.toHaveBeenCalled()
  })

  it('names the reason of a blocked selection in a toast', async () => {
    await mountTriage(buildChecksResponse({ workerOnline: false }))
    await check([1, 2])

    await press('C')
    expect(createChecks).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledWith('No Auto-check queued', WORKER_OFFLINE_REASON)
  })

  it('ignores Shift+C while Auto-check is off', async () => {
    await mountTriage(buildChecksResponse({ enabled: false }))
    await check([1])

    await press('C')
    expect(createChecks).not.toHaveBeenCalled()
    expect(notifyNotice).not.toHaveBeenCalled()
  })

  it('runs the Auto-check hint on the checked rows, else on the panel finding', async () => {
    await mountTriage()
    const hints = useHintActionsStore()

    expect(hints.reasonOf('autoCheck')).toBe(NO_FINDING_REASON)

    await check([1, 4])
    expect(hints.reasonOf('autoCheck')).toBeNull()

    await hints.run('autoCheck', false)
    await flushPromises()
    expect(createChecks).toHaveBeenCalledExactlyOnceWith([1, 4])
  })

  it('counts the checked rows without an open check on the hint', async () => {
    await mountTriage(
      buildChecksResponse({
        running: buildCheck({ findingId: 2, state: 'running', position: null }),
      }),
    )
    const hints = useHintActionsStore()

    expect(hints.bulkOf('autoCheck')).toBeNull()

    await check([1, 2, 3])
    expect(hints.bulkOf('autoCheck')).toEqual({
      count: { affected: 2, selected: 3, skipped: [OPEN_SKIP_REASON] },
      noun: FINDING_NOUN,
    })
  })
})

describe('selection Auto-check queue cap', () => {
  it('blocks every checked row once the queue is full and names it on Shift+C', async () => {
    await mountTriage(buildChecksResponse({ queued: queuedChecks(MAX_OPEN_CHECKS) }))
    await check([1, 2])

    const reason = 'The queue is full (500 open checks).'

    expect(useHintActionsStore().reasonOf('autoCheck')).toBe(reason)

    await press('C')
    expect(createChecks).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledWith('No Auto-check queued', reason)
  })

  it('blocks a selection larger than the room left instead of queueing part of it', async () => {
    await mountTriage(
      buildChecksResponse({
        running: buildCheck({ id: 999, findingId: 999, state: 'running', position: null }),
        queued: queuedChecks(MAX_OPEN_CHECKS - 3),
      }),
    )
    await check([1, 2, 3])

    const reason =
      'The queue holds at most 500 checks: 498 are open, so at most 2 more fit. Select fewer findings.'
    const hints = useHintActionsStore()

    expect(hints.reasonOf('autoCheck')).toBe(reason)
    expect(await hints.run('autoCheck', false)).toBe(false)

    await press('C')
    expect(createChecks).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledWith('No Auto-check queued', reason)
  })

  it('queues a selection that fits into the room left', async () => {
    await mountTriage(buildChecksResponse({ queued: queuedChecks(MAX_OPEN_CHECKS - 2) }))
    await check([1, 2])

    expect(useHintActionsStore().reasonOf('autoCheck')).toBeNull()

    await press('C')
    expect(createChecks).toHaveBeenCalledExactlyOnceWith([1, 2])
  })
})
