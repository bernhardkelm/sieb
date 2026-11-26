import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchDecisions } from '@/api/decisionsApi'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { emptyFilters } from '@/stores/findingFilters'
import { useFindingsStore } from '@/stores/findingsStore'
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

let mounted: RoutedMount | null = null

/**
 * Mounts the triage view at a path with two loaded findings.
 * @param {string} path - Path with query string
 * @returns {Promise<RoutedMount>} - Mounted view once the findings are loaded
 */
const mountTriage = async (path: string): Promise<RoutedMount> => {
  vi.mocked(fetchFindings).mockResolvedValue([
    buildFindingView({ id: 1, vulnId: 'CVE-2026-0001', severity: 'Critical' }),
    buildFindingView({ id: 2, vulnId: 'CVE-2026-0002', severity: 'Low' }),
  ])
  vi.mocked(fetchDecisions).mockResolvedValue([])
  mounted = await mountWithRouter(TriageView, path)
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

describe('TriageView filter query', () => {
  it('restores the filters of a link and ignores invalid values', async () => {
    await mountTriage('/triage?sev=critical,severe&kev=maybe&finding=7')

    expect(useFindingsStore().filters).toEqual({ ...emptyFilters(), severity: ['Critical'] })
    expect(listedIds()).toEqual(['1'])
  })

  it('writes a changed filter into the query by replacing the entry, keeping other params', async () => {
    const { wrapper, router } = await mountTriage('/triage?finding=2&sort=severity&dir=asc')
    const push = vi.spyOn(router, 'push')
    const replace = vi.spyOn(router, 'replace')

    await wrapper.get('input[type="search"]').setValue('0002')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({
      finding: '2',
      sort: 'severity',
      dir: 'asc',
      q: '0002',
    })
    expect(replace).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(listedIds()).toEqual(['2'])
  })

  it('follows a navigation to other filter params', async () => {
    const { router } = await mountTriage('/triage?q=0002')

    await router.replace('/triage?kev=1&sev=critical')
    await flushPromises()

    expect(useFindingsStore().filters).toEqual({
      ...emptyFilters(),
      severity: ['Critical'],
      kev: true,
    })
  })

  it('clears the filter params on reset', async () => {
    const { wrapper, router } = await mountTriage('/triage?q=nothing-matches&finding=1')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reset filters')!
      .trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ finding: '1' })
    expect(useFindingsStore().filters).toEqual(emptyFilters())
    expect(listedIds()).toEqual(['1', '2'])
  })
})
