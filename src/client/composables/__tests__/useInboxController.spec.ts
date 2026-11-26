import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import { fetchFindings } from '@/api/findingsApi'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useInboxController, type InboxController } from '@/composables/useInboxController'
import { useFindingDetailStore } from '@/stores/findingDetailStore'
import { useFindingsStore } from '@/stores/findingsStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<typeof fetchFindings>(),
  fetchFindingDetail: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

let controller: InboxController
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    controller = useInboxController(() => {})

    return () =>
      h('div', [
        h('a', { href: '/cves', id: 'link' }, 'By CVE'),
        h('div', { 'data-shortcut-scope': 'panel' }, [h('button', { id: 'radio' }, 'Accepted')]),
      ])
  },
})

/**
 * Presses a key on an element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @param {Element} target - Focused element
 * @returns {Promise<void>} - Resolves after navigation settled
 */
const press = async (key: string, target: Element = document.body): Promise<void> => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(fetchFindings).mockResolvedValue([
    buildFindingView({ id: 1, imageRef: 'index.docker.io/library/nginx' }),
    buildFindingView({ id: 2, imageRef: 'index.docker.io/library/redis' }),
    buildFindingView({ id: 3, imageRef: 'index.docker.io/library/postgres' }),
  ])
})

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  document.body.innerHTML = ''
})

/**
 * Mounts the inbox host at a path and waits for the findings.
 * @param {string} path - Path with query string
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountInbox = async (path: string): Promise<RoutedMount> => {
  mounted = await mountWithRouter(Host, path)
  await flushPromises()
  return mounted
}

describe('useInboxController', () => {
  it('leaves Enter on a link or button to the control', async () => {
    const { router } = await mountInbox('/inbox')

    await press('Enter', document.getElementById('link')!)
    expect(router.currentRoute.value.query.finding).toBeUndefined()

    await press('Enter')
    expect(router.currentRoute.value.query.finding).toBe('1')
  })

  it('hands the panel to the next row when the shown row is decided', async () => {
    const { router } = await mountInbox('/inbox?finding=2')
    const store = useFindingsStore()

    expect(controller.currentId.value).toBe(2)

    const shown = store.items[1]!

    store.applyDecision(buildDecision({ vulnId: shown.vulnId, imageRef: shown.imageRef }), {
      state: 'active',
    })
    await flushPromises()

    expect(controller.currentId.value).toBe(3)
    expect(router.currentRoute.value.query.finding).toBe('3')
  })

  it('moves panel and cursor together with j, once per key', async () => {
    const { router } = await mountInbox('/inbox?finding=1')
    const replace = vi.spyOn(router, 'replace')

    await press('j')

    expect(controller.currentId.value).toBe(2)
    expect(router.currentRoute.value.query.finding).toBe('2')
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('keeps j, k and Escape from discarding an unsaved draft in the panel', async () => {
    const { router } = await mountInbox('/inbox?finding=1')

    useFindingDetailStore().setDraftDirty(true)
    await press('j', document.getElementById('radio')!)
    await press('Escape')

    expect(controller.currentId.value).toBe(1)
    expect(router.currentRoute.value.query.finding).toBe('1')
  })

  it('orders rows and j by the sort in the URL', async () => {
    await mountInbox('/inbox?sort=image&dir=asc')

    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 3, 2])
    expect(controller.currentId.value).toBe(1)

    await press('j')

    expect(controller.currentId.value).toBe(3)
  })

  it('falls back to the triage order for an unknown sort', async () => {
    await mountInbox('/inbox?sort=bogus&dir=asc')

    expect(controller.sort.sort.value).toBeNull()
    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 2, 3])
  })

  it('keeps the cursor on the same finding when the sort changes', async () => {
    const { router } = await mountInbox('/inbox?finding=2')

    await controller.sort.toggle('image')
    await flushPromises()

    expect(router.currentRoute.value.query).toMatchObject({ sort: 'image', dir: 'asc' })
    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 3, 2])
    expect(controller.currentId.value).toBe(2)

    await controller.sort.toggle('image')
    await flushPromises()

    expect(controller.findings.value.map((finding) => finding.id)).toEqual([2, 3, 1])
    expect(controller.currentId.value).toBe(2)

    await press('j')

    expect(controller.currentId.value).toBe(3)

    await controller.sort.toggle('image')
    await flushPromises()

    expect(router.currentRoute.value.query.sort).toBeUndefined()
    expect(controller.findings.value.map((finding) => finding.id)).toEqual([1, 2, 3])
    expect(controller.currentId.value).toBe(3)
  })
})
