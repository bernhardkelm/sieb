import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { MAX_OPEN_CHECKS } from '#core/checkLimits.ts'
import type { ChecksResponse } from '#core/check.ts'
import type { InboxResponse } from '#core/inboxApiTypes.ts'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { fetchFindings } from '@/api/findingsApi'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAutoCheckHintActions } from '@/composables/useAutoCheckHintActions'
import { useHandoffHintActions } from '@/composables/useHandoffHintActions'
import { useTriageController, type TriageController } from '@/composables/useTriageController'
import { OPEN_SKIP_REASON } from '@/format/checkBlockReason'
import { useChecksStore } from '@/stores/checksStore'
import { useMcpStore } from '@/stores/mcpStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(() => new Promise(() => {})),
}))
vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(() => new Promise(() => {})),
}))
vi.mock('@/components/overview/OverviewStats.vue', () => ({ default: { render: () => null } }))

let controller: TriageController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    useAutoCheckHintActions()
    useHandoffHintActions()
    controller = useTriageController(() => {})

    return () => h(AppSidebar)
  },
})

/**
 * Mounts the sidebar on Triage with four findings, the Claude integration and Auto-check on.
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
 * Returns the hint button whose shortcut keys match.
 * @param {string} keys - Text of the keys, such as "⇧C"
 * @returns {HTMLButtonElement} - Hint button
 */
const hintOf = (keys: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>('.hints button')].find(
    (button) => button.querySelector('.key-hint')?.textContent === keys,
  )!

/**
 * Returns the visible label and the accessible label of a hint.
 * @param {string} keys - Text of the keys
 * @returns {[string, string | undefined]} - Visible label, accessible label when it differs
 */
const labelOf = (keys: string): [string, string | undefined] => {
  const button = hintOf(keys)

  return [
    [...button.querySelectorAll(':scope > span:not([hidden])')].at(-1)!.textContent!,
    button.querySelector('.visually-hidden')?.textContent ?? undefined,
  ]
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('AppSidebar counts on Triage', () => {
  it('keeps the plain labels without checked rows and counts the checked rows', async () => {
    await mountTriage(buildChecksResponse({ queued: [buildCheck({ findingId: 2 })] }))

    expect(labelOf('a')).toEqual(['Accept', undefined])
    expect(labelOf('⇧C')).toEqual(['Auto-check', undefined])
    expect(labelOf('h')).toEqual(['Copy for Claude', undefined])

    for (const id of [1, 2, 3]) {
      controller.toggleChecked(id)
    }
    await flushPromises()

    expect(labelOf('a')).toEqual(['Accept 3', 'Accept 3 findings'])
    expect(labelOf('n')).toEqual(['Not affected 3', 'Not affected 3 findings'])
    expect(labelOf('f')).toEqual(['Fix planned 3', 'Fix planned 3 findings'])
    expect(labelOf('⇧H')).toEqual(['Open 3 in Claude', 'Open 3 findings in Claude'])
    expect(labelOf('h')).toEqual(['Copy 3 for Claude', 'Copy 3 findings for Claude'])
    expect(labelOf('y')).toEqual([
      'Copy claude command for 3',
      'Copy claude command for 3 findings',
    ])
    expect(labelOf('⇧C')).toEqual(['Auto-check 2', 'Auto-check 2 findings'])
    expect(hintOf('⇧C').title).toBe(`2 of 3 selected. ${OPEN_SKIP_REASON}`)

    controller.clearChecked()
    await flushPromises()

    expect(labelOf('a')).toEqual(['Accept', undefined])
    expect(labelOf('⇧C')).toEqual(['Auto-check', undefined])
  })

  it('disables the Auto-check hint with the queue reason while the rows do not fit', async () => {
    const queued = Array.from({ length: MAX_OPEN_CHECKS }, (_, index) =>
      buildCheck({ id: 100 + index, findingId: 100 + index, position: index + 1 }),
    )

    await mountTriage(buildChecksResponse({ queued }))
    controller.toggleChecked(1)
    await flushPromises()

    expect(labelOf('⇧C')).toEqual(['Auto-check 1', 'Auto-check 1 finding'])
    expect(hintOf('⇧C').getAttribute('aria-disabled')).toBe('true')
    expect(hintOf('⇧C').title).toBe('The queue is full (500 open checks).')
  })
})
