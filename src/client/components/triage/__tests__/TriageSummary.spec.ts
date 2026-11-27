import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { CheckCreateResponse, ChecksResponse } from '#core/check.ts'
import { buildChecksResponse } from '@/__tests__/checkBuilders'
import { visibleText } from '@/__tests__/visibleText'
import TriageSummary from '@/components/triage/TriageSummary.vue'
import { useChecksStore } from '@/stores/checksStore'
import { useHandoffSelectionStore } from '@/stores/handoffSelectionStore'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(),
  createChecks: vi.fn<(ids: number[]) => Promise<CheckCreateResponse>>(),
  cancelCheck: vi.fn<(id: number) => Promise<void>>(),
}))

let wrapper: VueWrapper | null = null

/**
 * Mounts the summary with checked findings in the selection store.
 * @param {ChecksResponse | null} checks - Checks answer, null before one arrived
 * @returns {Promise<VueWrapper>} - Summary wrapper
 */
const mountSummary = async (checks: ChecksResponse | null): Promise<VueWrapper> => {
  const pinia = createPinia()

  setActivePinia(pinia)
  useMcpStore().info = { enabled: true, mcpUrl: null, oauth: false, claude: null }
  useChecksStore().response = checks
  useHandoffSelectionStore().register(() => [
    buildFindingView({ id: 1 }),
    buildFindingView({ id: 2 }),
  ])
  wrapper = mount(TriageSummary, {
    props: { shown: 4, total: 4, newCount: 0, checkedCount: 2, sortLabel: null },
    global: { plugins: [pinia] },
  })
  await flushPromises()
  return wrapper
}

/**
 * Returns the labels of the summary buttons.
 * @returns {string[]} - Visible button texts
 */
const labels = (): string[] =>
  wrapper!.findAll('button').map((button) => visibleText(button.element))

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('TriageSummary', () => {
  it('offers the Auto-check of the selection only while Auto-check is on', async () => {
    await mountSummary(null)
    expect(labels()).toEqual(['Decide 2'])

    useChecksStore().response = buildChecksResponse({ enabled: false })
    await flushPromises()
    expect(labels()).toEqual(['Decide 2'])

    useChecksStore().response = buildChecksResponse()
    await flushPromises()
    expect(labels()).toEqual(['Decide 2', 'Auto-check 2'])
  })

  it('marks a blocked Auto-check with its reason, focusable', async () => {
    await mountSummary(buildChecksResponse({ workerOnline: false }))
    const button = wrapper!.findAll('button')[1]!.element

    expect(button.classList).toContain('ghost')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('tabindex')).toBe(false)
    expect(button.querySelector('[hidden]')?.id).toBe(button.getAttribute('aria-describedby'))
  })
})
