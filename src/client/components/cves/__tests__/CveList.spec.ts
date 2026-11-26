import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { CveAggregate } from '#core/cveAggregation.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { mountWithRouter } from '@/__tests__/mountWithRouter'
import CveList from '@/components/cves/CveList.vue'
import { CVE_SORT_COLUMNS, sortCves } from '@/components/cves/cveSort'
import { useListSort } from '@/composables/useListSort'
import { groupRowKey } from '@/keyboard/rowKey'

/**
 * Builds a CVE aggregate.
 * @param {string} vulnId - Vuln id
 * @param {Partial<CveAggregate>} overrides - Fields to set
 * @returns {CveAggregate} - Aggregate
 */
const cve = (vulnId: string, overrides: Partial<CveAggregate> = {}): CveAggregate => ({
  vulnId,
  title: 'openssl: something',
  primaryLink: null,
  kev: false,
  maxSeverity: 'High',
  maxScore: 7.5,
  maxExposure: 'public',
  imageCount: 2,
  imageRefs: ['index.docker.io/library/nginx', 'index.docker.io/library/redis'],
  openCount: 2,
  inboxCount: 1,
  decisionStates: {
    undecided: 1,
    active: 1,
    fix_planned: 0,
    expired: 0,
    reopened: 0,
    revoked: 0,
  },
  allScopeDecision: null,
  allScopeEffective: null,
  ...overrides,
})

beforeEach(() => {
  // jsdom lacks window.scrollTo, the virtualizer corrects the scroll position as rows measure
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CveList', () => {
  it('shows the decision summary and the all-scope decision of a CVE', () => {
    const wrapper = mountWithProviders(CveList, {
      cves: [
        cve('CVE-2025-1', { kev: true }),
        cve('CVE-2025-2', {
          allScopeDecision: buildDecision({ scope: 'all', status: 'accepted' }),
        }),
      ],
      expandedId: null,
      currentKey: null,
      findings: [],
      findingsLoaded: true,
      sort: null,
      summaries: new Map([['CVE-2025-1', '1 accepted, 1 undecided']]),
    })
    const rows = wrapper.findAll('[role="row"][aria-level]')

    expect(rows[0]!.text()).toContain('KEV')
    expect(rows[0]!.text()).toContain('1 accepted, 1 undecided')
    expect(rows[1]!.text()).toContain('All · Accepted')
  })

  it('offers both bulk actions for the expanded CVE', async () => {
    const onBulk = vi.fn<(vulnId: string) => void>()
    const onDecideAll = vi.fn<(vulnId: string) => void>()
    const wrapper = mountWithProviders(CveList, {
      cves: [cve('CVE-2025-1')],
      expandedId: 'CVE-2025-1',
      currentKey: groupRowKey('CVE-2025-1'),
      findings: [buildFindingView({ id: 3, vulnId: 'CVE-2025-1' })],
      findingsLoaded: true,
      sort: null,
      summaries: new Map(),
      onBulk,
      onDecideAll,
    })
    const buttons = wrapper.findAll('button')

    await buttons.find((button) => button.text().startsWith('Decide open images'))!.trigger('click')
    await buttons
      .find((button) => button.text().startsWith('Decide for all images'))!
      .trigger('click')

    expect(onBulk).toHaveBeenCalledWith('CVE-2025-1')
    expect(onDecideAll).toHaveBeenCalledWith('CVE-2025-1')
    expect(wrapper.find('[data-finding-id="3"]').exists()).toBe(true)
  })

  it('sorts by a clicked column header and marks it with aria-sort', async () => {
    const items = [
      cve('CVE-2025-1', { imageCount: 1 }),
      cve('CVE-2025-2', { imageCount: 3 }),
      cve('CVE-2025-3', { imageCount: 2 }),
    ]
    const Host = defineComponent({
      setup: () => {
        const { sort, toggle } = useListSort(CVE_SORT_COLUMNS)
        const sorted = computed(() => sortCves(items, sort.value))

        return () =>
          h(CveList, {
            cves: sorted.value,
            expandedId: null,
            currentKey: null,
            findings: [],
            findingsLoaded: true,
            summaries: new Map(),
            sort: sort.value,
            onSort: toggle,
          })
      },
    })
    const { wrapper, router } = await mountWithRouter(Host, '/cves')
    const order = (): string[] =>
      wrapper.findAll('[data-row-key]').map((row) => row.find('.vuln-id').text())
    const header = (): ReturnType<typeof wrapper.find> =>
      wrapper.findAll('[role="columnheader"]').find((cell) => cell.text().startsWith('Images'))!

    expect(header().attributes('aria-sort')).toBeUndefined()

    await header().find('button').trigger('click')
    await flushPromises()

    expect(order()).toEqual(['CVE-2025-2', 'CVE-2025-3', 'CVE-2025-1'])
    expect(header().attributes('aria-sort')).toBe('descending')
    expect(router.currentRoute.value.query).toMatchObject({ sort: 'images', dir: 'desc' })

    await header().find('button').trigger('click')
    await flushPromises()

    expect(order()).toEqual(['CVE-2025-1', 'CVE-2025-3', 'CVE-2025-2'])
    expect(header().attributes('aria-sort')).toBe('ascending')

    await header().find('button').trigger('click')
    await flushPromises()

    expect(order()).toEqual(['CVE-2025-1', 'CVE-2025-2', 'CVE-2025-3'])
    expect(header().attributes('aria-sort')).toBeUndefined()
    wrapper.unmount()
  })
})
