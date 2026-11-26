import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { FindingView } from '#core/findingView.ts'
import { aggregateImages } from '#core/imageAggregation.ts'
import { fetchFindings } from '@/api/findingsApi'
import { fetchImages } from '@/api/imagesApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { emptyAggregateFilters } from '@/components/filters/aggregateFilters'
import { useImagesController, type ImagesController } from '@/composables/useImagesController'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { useLabelsStore } from '@/stores/labelsStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/imagesApi', () => ({
  fetchImages: vi.fn<typeof fetchImages>(),
}))

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

const FINDINGS: FindingView[] = [
  buildFindingView({ id: 1, imageRef: NGINX, vulnId: 'CVE-1', exposure: 'public', owner: 'self' }),
  buildFindingView({ id: 2, imageRef: NGINX, vulnId: 'CVE-2', exposure: 'public', owner: 'self' }),
  buildFindingView({
    id: 3,
    imageRef: NGINX,
    vulnId: 'CVE-3',
    decision: buildDecision({ id: 3, vulnId: 'CVE-3', imageRef: NGINX, status: 'not_affected' }),
    effective: { state: 'active' },
    inInbox: false,
  }),
  buildFindingView({ id: 4, imageRef: REDIS, vulnId: 'CVE-4', exposure: null, owner: null }),
]

const focusSearch = vi.fn<() => void>()
let controller: ImagesController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    controller = useImagesController(focusSearch)

    return () => h('div')
  },
})

/**
 * Presses a key on the page, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @returns {Promise<void>} - Resolves after navigation settled
 */
const press = async (key: string): Promise<void> => {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
  await flushPromises()
}

/**
 * Mounts the images host at a path once images and findings are loaded.
 * @param {string} path - Path with query string
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountImages = async (path: string): Promise<RoutedMount> => {
  mounted = await mountWithRouter(Host, path)
  await flushPromises()
  return mounted
}

/**
 * Returns the image refs the view lists.
 * @returns {string[]} - Image refs in list order
 */
const listed = (): string[] => controller.images.value.map((image) => image.imageRef)

beforeEach(() => {
  vi.mocked(fetchFindings).mockResolvedValue(FINDINGS)
  vi.mocked(fetchImages).mockResolvedValue(aggregateImages(FINDINGS))
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('useImagesController filtering', () => {
  it('filters by search and severity and counts the images the not affected toggle hides', async () => {
    await mountImages('/images')

    expect(listed()).toEqual([NGINX, REDIS])
    expect(controller.hiddenCount.value).toBe(0)

    controller.filters.value = { ...emptyAggregateFilters(), q: 'redis' }
    expect(listed()).toEqual([REDIS])

    controller.filters.value = { ...emptyAggregateFilters(), severity: ['Low'] }
    expect(listed()).toEqual([])
  })

  it('ignores exposure and owner filters while their columns are hidden', async () => {
    await mountImages('/images')

    controller.filters.value = { ...emptyAggregateFilters(), exposure: ['unknown'], owner: [] }
    expect(listed()).toEqual([NGINX, REDIS])

    useLabelsStore().data = { exposure: true, owners: ['self'], kev: 'cisa' }
    expect(listed()).toEqual([REDIS])

    controller.filters.value = { ...emptyAggregateFilters(), owner: ['self'] }
    expect(listed()).toEqual([NGINX])
  })
})

describe('useImagesController sort', () => {
  it('sorts by the query params and falls back to the default order for hidden columns', async () => {
    const { router } = await mountImages('/images?sort=name&dir=desc')

    expect(listed()).toEqual([REDIS, NGINX])
    expect(controller.sort.label.value).not.toBeNull()

    await router.replace('/images?sort=owner&dir=desc')
    expect(controller.sort.sort.value).toBeNull()
    expect(listed()).toEqual([NGINX, REDIS])

    useLabelsStore().data = { exposure: false, owners: ['self'], kev: 'cisa' }
    expect(controller.sort.sort.value).toEqual({ column: 'owner', direction: 'desc' })
  })

  it('returns to the default order on reset', async () => {
    const { router } = await mountImages('/images?sort=name&dir=desc')

    await controller.resetSort()
    expect(router.currentRoute.value.query).toEqual({})
    expect(listed()).toEqual([NGINX, REDIS])
  })
})

describe('useImagesController expanded group and cursor', () => {
  it('lists the open findings of the linked image without not affected ones, cursor on its row', async () => {
    await mountImages(`/images?image=${encodeURIComponent(NGINX)}`)

    expect(controller.expandedRef.value).toBe(NGINX)
    expect(controller.expandedFindings.value.map((finding) => finding.id)).toEqual([1, 2])
    expect(controller.currentKey.value).toBe(groupRowKey(NGINX))

    controller.filters.value = { ...emptyAggregateFilters(), showNotAffected: true }
    expect(controller.expandedFindings.value.map((finding) => finding.id)).toEqual([1, 2, 3])
  })

  it('expands with Enter, steps into the findings and collapses with Escape', async () => {
    const { router } = await mountImages('/images')

    expect(controller.currentKey.value).toBe(groupRowKey(NGINX))

    await press('Enter')
    expect(router.currentRoute.value.query.image).toBe(NGINX)

    await press('j')
    expect(controller.currentKey.value).toBe(findingRowKey(1))

    await press('Escape')
    expect(router.currentRoute.value.query.image).toBeUndefined()
    expect(controller.currentKey.value).toBe(groupRowKey(NGINX))
  })

  it('opens a finding row in the panel on select and focuses the search on /', async () => {
    const { router } = await mountImages(`/images?image=${encodeURIComponent(NGINX)}`)

    controller.select(findingRowKey(2))
    await flushPromises()
    expect(router.currentRoute.value.query.finding).toBe('2')

    await press('/')
    expect(focusSearch).toHaveBeenCalled()
  })
})
