import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchDecisions } from '@/api/decisionsApi'
import { fetchFindings } from '@/api/findingsApi'
import { buildCheck, buildChecksResponse } from '@/__tests__/checkBuilders'
import { proposalItem } from '@/__tests__/inboxItemBuilders'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useChecksStore } from '@/stores/checksStore'
import { emptyFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'
import { useInboxStore } from '@/stores/inboxStore'
import TriageView from '@/views/TriageView.vue'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/decisionsApi', () => ({
  fetchDecisions: vi.fn<typeof fetchDecisions>(),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

const NGINX = 'index.docker.io/library/nginx'

let mounted: RoutedMount | null = null

/**
 * Mounts the triage view at a path over three findings: 1 with a proposal on its image, 2 with a
 * queued check, 3 untouched, Auto-check on or off.
 * @param {string} path - Path with query string
 * @param {boolean} checksEnabled - Whether Auto-check is on
 * @returns {Promise<RoutedMount>} - Mounted view once the findings are loaded
 */
const mountTriage = async (path: string, checksEnabled = true): Promise<RoutedMount> => {
  vi.mocked(fetchFindings).mockResolvedValue([
    buildFindingView({ id: 1, vulnId: 'CVE-2026-0001', imageRef: NGINX }),
    buildFindingView({ id: 2, vulnId: 'CVE-2026-0002', imageRef: NGINX }),
    buildFindingView({ id: 3, vulnId: 'CVE-2026-0003', imageRef: NGINX }),
  ])
  vi.mocked(fetchDecisions).mockResolvedValue([])
  mounted = await mountWithRouter(TriageView, path)
  useInboxStore().items = [proposalItem(9, { vulnId: 'CVE-2026-0001', imageRefs: [NGINX] })]
  useChecksStore().response = buildChecksResponse({
    enabled: checksEnabled,
    queued: [buildCheck({ findingId: 2 })],
  })
  await useFindingsStore().refresh()
  await flushPromises()
  return mounted
}

/**
 * Returns the ids of the listed findings.
 * @returns {string[]} - Finding ids in list order
 */
const listedIds = (): string[] =>
  [...document.querySelectorAll<HTMLElement>('[data-finding-id]')].map(
    (row) => row.dataset.findingId ?? '',
  )

/**
 * Opens the Pending filter and returns the labels of its options.
 * @param {RoutedMount} view - Mounted view
 * @returns {Promise<HTMLLabelElement[]>} - Option labels in the popover
 */
const openPending = async ({ wrapper }: RoutedMount): Promise<HTMLLabelElement[]> => {
  await wrapper
    .findAll('button')
    .find((button) => button.text().startsWith('Pending'))!
    .trigger('click')
  await flushPromises()
  return [...document.querySelectorAll<HTMLLabelElement>('[role="dialog"] label')]
}

beforeEach(() => {
  // jsdom lacks window.scrollTo, the virtualizer corrects the scroll position as rows measure
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // jsdom lacks scrollIntoView, the list reveals its current row
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('TriageView pending filter', () => {
  it('restores the pending options of a link and ignores invalid ones', async () => {
    await mountTriage('/triage?pending=proposed,later,checking')

    expect(useFindingsStore().filters).toEqual({
      ...emptyFilters(),
      pending: ['proposed', 'checking'],
    })
    expect(listedIds()).toEqual(['1', '2'])
  })

  it('adds an option from the filter bar to the list and the query', async () => {
    const view = await mountTriage('/triage?pending=proposed')
    const options = await openPending(view)

    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Proposed',
      'Re-opened',
      'New KEV',
      'Checking',
      'Untouched',
    ])

    options.at(-1)!.querySelector('button')!.click()
    await flushPromises()

    expect(view.router.currentRoute.value.query).toEqual({ pending: 'proposed,untouched' })
    expect(listedIds()).toEqual(['1', '3'])
  })

  it('offers checking only while Auto-check is on and ignores it otherwise', async () => {
    const view = await mountTriage('/triage?pending=checking', false)
    const options = await openPending(view)

    expect(options.map((option) => option.textContent?.trim())).not.toContain('Checking')
    expect(listedIds()).toEqual(['1', '2', '3'])
  })

  it('clears the pending filter with the reset button', async () => {
    const { wrapper, router } = await mountTriage('/triage?pending=untouched&finding=3')

    expect(listedIds()).toEqual(['3'])

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reset')!
      .trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ finding: '3' })
    expect(useFindingsStore().filters).toEqual(emptyFilters())
    expect(listedIds()).toEqual(['1', '2', '3'])
  })
})
