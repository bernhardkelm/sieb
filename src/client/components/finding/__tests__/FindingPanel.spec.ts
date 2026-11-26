import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingDetail } from '#core/findingView.ts'
import type { KevDetails } from '#core/kev.ts'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import { fetchFindingDetail } from '@/api/findingsApi'
import FindingPanel from '@/components/finding/FindingPanel.vue'
import { useLabelsStore } from '@/stores/labelsStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindingDetail: vi.fn<(id: number) => Promise<FindingDetail>>(),
}))

const KEV: KevDetails = {
  vendorProject: 'Example',
  product: 'Gateway',
  vulnerabilityName: 'Example Gateway Path Traversal Vulnerability',
  dateAdded: '2026-11-03',
  shortDescription: 'Example Gateway contains a path traversal vulnerability.',
  requiredAction: 'Apply mitigations per vendor instructions.',
  dueDate: '2026-11-24',
  knownRansomware: true,
  notes: null,
}

/**
 * Builds the detail of a KEV listed finding.
 * @param {KevDetails | null} kev - Catalog entry
 * @returns {FindingDetail} - Detail
 */
const detailWith = (kev: KevDetails | null): FindingDetail => ({
  finding: buildFindingView({ id: 1, kev: true }),
  instances: [],
  decisions: [],
  events: [],
  kev,
})

/**
 * Opens the panel of finding 1.
 * @returns {Promise<Awaited<ReturnType<typeof mountWithRouter>>['wrapper']>} - Mounted panel
 */
const openPanel = async (): Promise<Awaited<ReturnType<typeof mountWithRouter>>['wrapper']> => {
  const { wrapper } = await mountWithRouter(FindingPanel, '/inbox?finding=1')

  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(fetchFindingDetail).mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FindingPanel', () => {
  it('shows the CISA catalog details of a KEV listed finding', async () => {
    vi.mocked(fetchFindingDetail).mockResolvedValue(detailWith(KEV))
    const wrapper = await openPanel()
    const section = wrapper.get('[aria-labelledby="panel-kev"]')

    expect(section.text()).toContain('Known exploited')
    expect(section.text()).toContain('Example Gateway Path Traversal Vulnerability')
    expect(section.text()).toContain('Example Gateway contains a path traversal vulnerability.')
    expect(section.text()).toContain('Added')
    expect(section.text()).toContain('Nov 3, 2026')
    expect(section.text()).toContain('Nov 24, 2026')
    expect(section.get('.known').text()).toBe('Known')
    expect(section.text()).toContain('Apply mitigations per vendor instructions.')
    expect(wrapper.get('.finding-header').text()).toContain('KEV')
    wrapper.unmount()
  })

  it('leaves the section out without catalog details and hides the chip for the KEV source none', async () => {
    vi.mocked(fetchFindingDetail).mockResolvedValue(detailWith(null))
    const wrapper = await openPanel()

    expect(wrapper.find('[aria-labelledby="panel-kev"]').exists()).toBe(false)
    expect(wrapper.get('.finding-header .chips').text()).toContain('KEV')

    useLabelsStore().data = { exposure: false, owners: [], kev: 'none' }
    await flushPromises()

    expect(wrapper.get('.finding-header .chips').text()).not.toContain('KEV')
    expect(wrapper.get('.finding-header').text()).not.toContain('KEV catalog')
    wrapper.unmount()
  })
})
