import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { buildChecksResponse } from '@/__tests__/checkBuilders'
import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useNavigationShortcuts } from '@/composables/useNavigationShortcuts'
import { NAV_ITEMS } from '@/router/navItems'
import { ROUTE_NAMES } from '@/router/routeNames'
import { useChecksStore } from '@/stores/checksStore'

const Host = defineComponent({
  setup: () => {
    useNavigationShortcuts()
    return () => null
  },
})

let mounted: RoutedMount | null = null

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
})

describe('useNavigationShortcuts', () => {
  it('orders the views Triage, Inbox, By image, By CVE, Decisions, Checks on the keys 1 to 6', () => {
    expect(NAV_ITEMS.map((item) => [item.shortcut, item.label])).toEqual([
      ['1', 'Triage'],
      ['2', 'Inbox'],
      ['3', 'By image'],
      ['4', 'By CVE'],
      ['5', 'Decisions'],
      ['6', 'Checks'],
    ])
  })

  it('reaches the Checks view on 6 only while Auto-check is on', async () => {
    mounted = await mountWithRouter(Host, '/images')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }))
    await flushPromises()
    expect(mounted.router.currentRoute.value.name).toBe(ROUTE_NAMES.IMAGES)

    useChecksStore().response = buildChecksResponse()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }))
    await flushPromises()
    expect(mounted.router.currentRoute.value.name).toBe(ROUTE_NAMES.CHECKS)
  })

  it.each([
    ['1', ROUTE_NAMES.TRIAGE],
    ['2', ROUTE_NAMES.INBOX],
    ['3', ROUTE_NAMES.IMAGES],
    ['4', ROUTE_NAMES.CVES],
    ['5', ROUTE_NAMES.DECISIONS],
  ])('navigates on %s to %s', async (key, name) => {
    mounted = await mountWithRouter(Host, '/images?finding=3')
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    await flushPromises()

    expect(mounted.router.currentRoute.value.name).toBe(name)
    expect(mounted.router.currentRoute.value.query.finding).toBeUndefined()
  })
})
