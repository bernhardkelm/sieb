import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildDecision, buildFindingView, NOW } from '#core/__tests__/coreBuilders.ts'
import { aggregateCves } from '#core/cveAggregation.ts'
import type { FindingView } from '#core/findingView.ts'
import { fetchCves } from '@/api/cvesApi'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { emptyAggregateFilters } from '@/components/filters/aggregateFilters'
import { useCvesController, type CvesController } from '@/composables/useCvesController'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { useLabelsStore } from '@/stores/labelsStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/cvesApi', () => ({
  fetchCves: vi.fn<typeof fetchCves>(),
}))

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

const FINDINGS: FindingView[] = [
  buildFindingView({ id: 1, vulnId: 'CVE-2026-1', imageRef: NGINX, exposure: 'public' }),
  buildFindingView({ id: 2, vulnId: 'CVE-2026-1', imageRef: REDIS, exposure: 'public' }),
  buildFindingView({
    id: 3,
    vulnId: 'CVE-2026-2',
    imageRef: NGINX,
    severity: 'Low',
    exposure: null,
    title: 'zlib overflow',
  }),
  buildFindingView({
    id: 4,
    vulnId: 'CVE-2026-3',
    imageRef: NGINX,
    severity: 'High',
    decision: buildDecision({ id: 4, vulnId: 'CVE-2026-3', imageRef: NGINX }),
    effective: { state: 'active' },
    inInbox: false,
  }),
]

const focusSearch = vi.fn<() => void>()
let controller: CvesController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    controller = useCvesController(focusSearch)

    return () => h('div')
  },
})

/**
 * Presses a key on the page, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @param {KeyboardEventInit} init - Modifiers
 * @returns {Promise<void>} - Resolves after navigation settled
 */
const press = async (key: string, init: KeyboardEventInit = {}): Promise<void> => {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
  await flushPromises()
}

/**
 * Mounts the CVE host at a path once CVEs and findings are loaded.
 * @param {string} path - Path with query string
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountCves = async (path: string): Promise<RoutedMount> => {
  mounted = await mountWithRouter(Host, path)
  await flushPromises()
  return mounted
}

/**
 * Returns the vuln ids the view lists.
 * @returns {string[]} - Vuln ids in list order
 */
const listed = (): string[] => controller.cves.value.map((cve) => cve.vulnId)

beforeEach(() => {
  vi.mocked(fetchFindings).mockResolvedValue(FINDINGS)
  vi.mocked(fetchCves).mockResolvedValue(aggregateCves(FINDINGS, [], NOW))
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('useCvesController filtering', () => {
  it('hides fully decided CVEs until show decided and filters by search', async () => {
    await mountCves('/cves')

    expect(listed()).toEqual(['CVE-2026-1', 'CVE-2026-2'])
    expect(controller.hiddenCount.value).toBe(1)

    controller.filters.value = { ...emptyAggregateFilters(), showDecided: true }
    expect(listed()).toEqual(['CVE-2026-1', 'CVE-2026-2', 'CVE-2026-3'])
    expect(controller.hiddenCount.value).toBe(0)

    controller.filters.value = { ...emptyAggregateFilters(), q: 'zlib' }
    expect(listed()).toEqual(['CVE-2026-2'])
  })

  it('filters unknown exposure only while the exposure column shows', async () => {
    await mountCves('/cves')

    controller.filters.value = { ...emptyAggregateFilters(), exposure: ['unknown'] }
    expect(listed()).toEqual(['CVE-2026-1', 'CVE-2026-2'])

    useLabelsStore().data = { exposure: true, owners: [], kev: 'cisa' }
    expect(listed()).toEqual(['CVE-2026-2'])
  })

  it('summarizes the decisions per CVE', async () => {
    await mountCves('/cves')

    expect(controller.summaries.value.get('CVE-2026-3')).toBeTruthy()
    expect([...controller.summaries.value.keys()].sort()).toEqual([
      'CVE-2026-1',
      'CVE-2026-2',
      'CVE-2026-3',
    ])
  })
})

describe('useCvesController sort', () => {
  it('sorts by the query params, ignores hidden columns and resets', async () => {
    const { router } = await mountCves('/cves?sort=vulnId&dir=desc')

    expect(listed()).toEqual(['CVE-2026-2', 'CVE-2026-1'])

    await router.replace('/cves?sort=exposure&dir=asc')
    expect(controller.sort.sort.value).toBeNull()

    await controller.resetSort()
    expect(router.currentRoute.value.query).toEqual({})
    expect(listed()).toEqual(['CVE-2026-1', 'CVE-2026-2'])
  })
})

describe('useCvesController expanded group and cursor', () => {
  it('lists the open findings per image of the linked CVE with the cursor on its row', async () => {
    await mountCves('/cves?cve=CVE-2026-1')

    expect(controller.expandedId.value).toBe('CVE-2026-1')
    expect(controller.expandedFindings.value.map((finding) => finding.id)).toEqual([1, 2])
    expect(controller.currentKey.value).toBe(groupRowKey('CVE-2026-1'))
  })

  it('expands with ArrowRight, steps in and opens a finding with Enter', async () => {
    const { router } = await mountCves('/cves')

    await press('ArrowRight')
    expect(router.currentRoute.value.query.cve).toBe('CVE-2026-1')

    await press('ArrowRight')
    expect(controller.currentKey.value).toBe(findingRowKey(1))

    await press('Enter')
    expect(router.currentRoute.value.query.finding).toBe('1')
  })

  it('opens the bulk dialog with Shift+A and the all images dialog with Shift+D', async () => {
    await mountCves('/cves')

    await press('A', { shiftKey: true })
    expect(controller.bulkOpen.value).toBe(true)
    expect(controller.bulkTargets.value).toEqual([{ vulnId: 'CVE-2026-1', imageRefs: 'all-open' }])

    controller.bulkOpen.value = false
    await press('D', { shiftKey: true })
    expect(controller.decideOpen.value).toBe(true)
    expect(controller.decideCve.value?.vulnId).toBe('CVE-2026-1')
  })
})
