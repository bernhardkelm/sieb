import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useDraftGuard, type DraftGuard } from '@/composables/useDraftGuard'
import { DEEP_LINK_UNLOAD_WINDOW_MS, openDeepLink } from '@/router/deepLinkNavigation'

const dirty = ref(false)
let guard: DraftGuard
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    guard = useDraftGuard(() => dirty.value)

    return () => h('div')
  },
})

/**
 * Mounts the guard on the inbox with finding 1 open.
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountGuard = async (): Promise<RoutedMount> => {
  mounted = await mountWithRouter(Host, '/inbox?finding=1')
  return mounted
}

/**
 * Returns the open finding of the current route.
 * @param {RoutedMount} routed - Mounted guard
 * @returns {unknown} - Finding query value
 */
const shownFinding = (routed: RoutedMount): unknown =>
  routed.router.currentRoute.value.query.finding

/**
 * Dispatches a cancelable beforeunload event.
 * @returns {Event} - Dispatched event
 */
const unload = (): Event => {
  const event = new Event('beforeunload', { cancelable: true })

  window.dispatchEvent(event)
  return event
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  dirty.value = false
  document.body.innerHTML = ''
})

describe('useDraftGuard', () => {
  it('lets every navigation pass while the draft is clean', async () => {
    const routed = await mountGuard()

    await routed.router.replace('/inbox?finding=2')

    expect(guard.asking.value).toBe(false)
    expect(shownFinding(routed)).toBe('2')
  })

  it('holds a finding change of a dirty draft until Keep editing cancels it', async () => {
    const routed = await mountGuard()

    dirty.value = true
    const navigation = routed.router.replace('/inbox?finding=2')
    await flushPromises()

    expect(guard.asking.value).toBe(true)
    expect(shownFinding(routed)).toBe('1')

    guard.keep()
    await navigation

    expect(guard.asking.value).toBe(false)
    expect(shownFinding(routed)).toBe('1')
  })

  it('lets the navigation proceed on Discard', async () => {
    const routed = await mountGuard()

    dirty.value = true
    const navigation = routed.router.push({ name: 'images' })
    await flushPromises()

    expect(guard.asking.value).toBe(true)

    guard.discard()
    await navigation

    expect(routed.router.currentRoute.value.name).toBe('images')
    expect(shownFinding(routed)).toBeUndefined()
  })

  it('asks when the panel closes and passes navigations that keep the finding', async () => {
    const routed = await mountGuard()

    dirty.value = true
    await routed.router.replace('/cves?finding=1')
    expect(guard.asking.value).toBe(false)
    expect(routed.router.currentRoute.value.name).toBe('cves')

    const navigation = routed.router.replace('/cves')
    await flushPromises()
    expect(guard.asking.value).toBe(true)

    guard.keep()
    await navigation
    expect(shownFinding(routed)).toBe('1')
  })

  it('cancels a waiting navigation when a newer one replaces it', async () => {
    const routed = await mountGuard()

    dirty.value = true
    const first = routed.router.replace('/inbox?finding=2')
    await flushPromises()
    const second = routed.router.replace('/inbox?finding=3')
    await flushPromises()

    guard.discard()
    await Promise.all([first, second])

    expect(shownFinding(routed)).toBe('3')
  })

  it('stops guarding once the draft is saved or cancelled', async () => {
    const routed = await mountGuard()

    dirty.value = true
    dirty.value = false
    await routed.router.replace('/inbox?finding=2')

    expect(guard.asking.value).toBe(false)
    expect(shownFinding(routed)).toBe('2')
  })

  it('asks the browser before the tab closes with a dirty draft only', async () => {
    await mountGuard()

    expect(unload().defaultPrevented).toBe(false)

    dirty.value = true
    expect(unload().defaultPrevented).toBe(true)

    mounted?.wrapper.unmount()
    mounted = null
    expect(unload().defaultPrevented).toBe(false)
  })

  it('stays quiet for the beforeunload of a deep link and asks again afterwards', async () => {
    await mountGuard()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.stubGlobal('location', { ...window.location, assign: vi.fn<(url: string) => void>() })
    dirty.value = true

    try {
      openDeepLink('claude://code/new?q=Triage')
      expect(unload().defaultPrevented).toBe(false)

      vi.advanceTimersByTime(DEEP_LINK_UNLOAD_WINDOW_MS)
      expect(unload().defaultPrevented).toBe(true)
    } finally {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })
})
