import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CveAggregate } from '#core/cveAggregation.ts'
import { fetchCves } from '@/api/cvesApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useCvesStore } from '@/stores/cvesStore'
import CvesView from '@/views/CvesView.vue'

vi.mock('@/api/cvesApi', () => ({
  fetchCves: vi.fn<typeof fetchCves>(),
}))
vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

let mounted: RoutedMount | null = null

/**
 * Builds a CVE whose open findings all carry an active decision.
 * @param {string} vulnId - Vuln id
 * @returns {CveAggregate} - Fully decided aggregate
 */
const decidedCve = (vulnId: string): CveAggregate => ({
  vulnId,
  title: 'openssl: something',
  primaryLink: null,
  kev: false,
  maxSeverity: 'High',
  maxScore: 7.5,
  maxExposure: 'public',
  imageCount: 1,
  imageRefs: ['index.docker.io/library/nginx'],
  openCount: 1,
  inboxCount: 0,
  decisionStates: { undecided: 0, active: 1, fix_planned: 0, expired: 0, reopened: 0, revoked: 0 },
  allScopeDecision: null,
  allScopeEffective: null,
})

/**
 * Mounts the by-CVE view with loaded CVEs.
 * @param {CveAggregate[]} cves - CVEs the API returns
 * @returns {Promise<RoutedMount>} - Mounted view once the CVEs are loaded
 */
const mountCves = async (cves: CveAggregate[]): Promise<RoutedMount> => {
  vi.mocked(fetchCves).mockResolvedValue(cves)
  mounted = await mountWithRouter(CvesView, '/cves')
  await useCvesStore().refresh()
  await flushPromises()
  return mounted
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('CvesView empty states', () => {
  it('shows the all clear state with show decided when every CVE is decided', async () => {
    const { wrapper } = await mountCves([decidedCve('CVE-2025-1'), decidedCve('CVE-2025-2')])

    expect(wrapper.get('.all-clear h2').text()).toBe('Nothing left to decide')
    expect(wrapper.get('.all-clear .actions').text()).toBe('Show decided')
  })

  it('keeps the plain filtered empty state while a filter is set', async () => {
    const { wrapper } = await mountCves([decidedCve('CVE-2025-1')])

    await wrapper.get('input[type="search"]').setValue('nothing-matches')
    await flushPromises()

    expect(wrapper.find('.all-clear').exists()).toBe(false)
    expect(wrapper.text()).toContain('No CVE matches these filters.')
  })
})
