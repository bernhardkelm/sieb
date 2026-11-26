import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { ImageAggregate } from '#core/imageAggregation.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import ImageList from '@/components/images/ImageList.vue'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { useLabelsStore } from '@/stores/labelsStore'

const NGINX = 'index.docker.io/library/nginx'
const APP = 'registry.example.com/acme/demo-app'

/**
 * Builds an image aggregate.
 * @param {string} imageRef - Image
 * @param {Partial<ImageAggregate>} overrides - Fields to set
 * @returns {ImageAggregate} - Aggregate
 */
const image = (imageRef: string, overrides: Partial<ImageAggregate> = {}): ImageAggregate => ({
  imageRef,
  owner: 'third-party',
  maxExposure: 'internal',
  maxSeverity: 'High',
  openCount: 3,
  openBySeverity: { Critical: 1, High: 2, Medium: 0, Low: 0, Unknown: 0 },
  fixableCount: 3,
  kevCount: 1,
  inboxCount: 2,
  notAffectedCount: 1,
  acceptedCount: 0,
  workloadCount: 2,
  workloads: ['shop/Deployment/web', 'shop/Deployment/worker'],
  includingNotAffected: {
    maxSeverity: 'High',
    openCount: 3,
    openBySeverity: { Critical: 1, High: 2, Medium: 0, Low: 0, Unknown: 0 },
    fixableCount: 3,
    kevCount: 1,
  },
  ...overrides,
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ImageList', () => {
  it('renders one row per image with its counts and short name', async () => {
    const wrapper = mountWithProviders(ImageList, {
      images: [image(APP, { owner: 'self' }), image(NGINX)],
      expandedRef: null,
      currentKey: groupRowKey(APP),
      findings: [],
      findingsLoaded: true,
      sort: null,
    })

    useLabelsStore().data = { exposure: true, owners: ['self', 'third-party'], kev: 'cisa' }
    await nextTick()

    const rows = wrapper.findAll('[role="row"][aria-level]')

    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('demo-app')
    expect(rows[0]!.text()).toContain('Own')
    expect(wrapper.get('[role="treegrid"]').attributes('aria-label')).toBe('Images')
    expect(rows[0]!.attributes('aria-selected')).toBe('true')
    expect(rows[1]!.attributes('aria-selected')).toBe('false')
    expect(rows[0]!.attributes('aria-expanded')).toBe('false')
    expect(rows[1]!.find('[role="img"]').attributes('aria-label')).toBe('1 critical, 2 high')
  })

  it('lists the findings of the expanded image below its row', () => {
    const findings = [buildFindingView({ id: 5, vulnId: 'CVE-2025-5555', imageRef: NGINX })]
    const wrapper = mountWithProviders(ImageList, {
      images: [image(APP), image(NGINX)],
      expandedRef: NGINX,
      currentKey: null,
      findings,
      findingsLoaded: true,
      sort: null,
    })
    const keys = wrapper.findAll('[data-row-key]').map((row) => row.attributes('data-row-key'))

    expect(keys).toEqual([groupRowKey(APP), groupRowKey(NGINX), findingRowKey(5)])
    expect(wrapper.find('[data-finding-id="5"]').text()).toContain('Undecided')
  })

  it('emits the row key of a clicked row', async () => {
    const onSelect = vi.fn<(key: string) => void>()
    const wrapper = mountWithProviders(ImageList, {
      images: [image(NGINX)],
      expandedRef: null,
      currentKey: null,
      findings: [],
      findingsLoaded: true,
      sort: null,
      onSelect,
    })

    await wrapper.find('[role="row"][aria-level]').trigger('click')

    expect(onSelect).toHaveBeenCalledWith(groupRowKey(NGINX))
  })

  it('hides owner and exposure columns the open findings have no label for', async () => {
    const wrapper = mountWithProviders(ImageList, {
      images: [image(NGINX, { owner: null, maxExposure: null })],
      expandedRef: null,
      currentKey: null,
      findings: [],
      findingsLoaded: true,
      sort: null,
    })
    const labels = useLabelsStore()

    /**
     * Returns the column header labels.
     * @returns {string[]} - Header texts
     */
    const headers = (): string[] =>
      wrapper.findAll('[role="columnheader"]').map((header) => header.text())

    await nextTick()
    expect(headers()).not.toContain('Owner')
    expect(headers()).not.toContain('Exposure')
    expect(wrapper.get('[role="treegrid"]').classes()).toEqual(
      expect.arrayContaining(['no-exposure', 'no-owner']),
    )

    labels.data = { exposure: true, owners: ['platform'], kev: 'cisa' }
    await nextTick()
    expect(headers()).toEqual(expect.arrayContaining(['Owner', 'Exposure']))
    expect(wrapper.get('[role="treegrid"]').classes()).not.toContain('no-owner')
    expect(wrapper.get('.image-row .exposure').text()).toBe('')
  })

  it('drops the KEV column for the KEV source none', async () => {
    const wrapper = mountWithProviders(ImageList, {
      images: [image(NGINX)],
      expandedRef: null,
      currentKey: null,
      findings: [],
      findingsLoaded: true,
      sort: null,
    })
    const labels = useLabelsStore()

    await nextTick()
    expect(wrapper.findAll('[role="columnheader"]').map((header) => header.text())).toContain('KEV')

    labels.data = { exposure: true, owners: [], kev: 'none' }
    await nextTick()

    expect(wrapper.findAll('[role="columnheader"]').map((header) => header.text())).not.toContain(
      'KEV',
    )
    expect(wrapper.get('[role="treegrid"]').classes()).toContain('no-kev')
    expect(wrapper.get('.image-row').text()).not.toContain('KEV')
  })
})
