import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { mountWithRouter, type RoutedMount } from '@/__tests__/mountWithRouter'
import { useCursorList, type CursorList } from '@/composables/useCursorList'
import { findingRowKey, groupRowKey } from '@/keyboard/rowKey'
import { useFindingDetailStore } from '@/stores/findingDetailStore'

vi.mock('@/api/findingsApi', () => ({
  fetchFindings: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))

const keys = ref<string[]>([])
const activateGroup = vi.fn<(group: string) => void>()
const close = vi.fn<() => void>()
let cursor: CursorList
let mounted: RoutedMount | null = null

const Host = defineComponent({
  setup: () => {
    cursor = useCursorList({ keys, activateGroup, close, expanded: () => 'a' })

    return () => h('div', [h('button', { id: 'tab', role: 'tab' }, 'Active')])
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

/**
 * Mounts the list host at a path with group a expanded into findings 1 and 2, then group b.
 * @param {string} path - Path with query string
 * @returns {Promise<RoutedMount>} - Wrapper and router
 */
const mountList = async (path: string): Promise<RoutedMount> => {
  keys.value = [groupRowKey('a'), findingRowKey(1), findingRowKey(2), groupRowKey('b')]
  mounted = await mountWithRouter(Host, path)
  await flushPromises()
  return mounted
}

afterEach(() => {
  mounted?.wrapper.unmount()
  mounted = null
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('useCursorList', () => {
  it('expands the cursor group on Enter, unless a control has focus', async () => {
    await mountList('/images')

    await press('Enter', document.getElementById('tab')!)
    expect(activateGroup).not.toHaveBeenCalled()

    await press('Enter')
    expect(activateGroup).toHaveBeenCalledWith('a')
  })

  it('toggles the cursor group and opens a nested finding on Space, as Enter does', async () => {
    const { router } = await mountList('/images')

    await press(' ', document.getElementById('tab')!)
    expect(activateGroup).not.toHaveBeenCalled()

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })

    document.body.dispatchEvent(event)
    await flushPromises()
    expect(activateGroup).toHaveBeenCalledWith('a')
    expect(event.defaultPrevented).toBe(true)

    await press('j')
    await press(' ')
    expect(router.currentRoute.value.query.finding).toBe('1')
  })

  it('puts the cursor on a finding opened by link and follows it with the panel', async () => {
    const { router } = await mountList('/images?finding=1')

    expect(cursor.currentKey.value).toBe(findingRowKey(1))

    await press('j')
    expect(router.currentRoute.value.query.finding).toBe('2')

    await press('j')
    expect(cursor.currentKey.value).toBe(groupRowKey('b'))
    expect(router.currentRoute.value.query.finding).toBe('2')
  })

  it('collapses on Escape only while the panel is closed and no draft is pending', async () => {
    const { router } = await mountList('/images?finding=1')

    await press('Escape')
    expect(close).not.toHaveBeenCalled()

    await router.replace({ query: {} })
    useFindingDetailStore().setDraftDirty(true)
    await press('j')
    expect(cursor.currentKey.value).toBe(findingRowKey(1))

    useFindingDetailStore().setDraftDirty(false)
    await press('Escape')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('steps through the tree with ArrowRight and ArrowLeft', async () => {
    await mountList('/images')

    await press('ArrowRight')
    expect(cursor.currentKey.value).toBe(findingRowKey(1))

    await press('ArrowLeft')
    expect(cursor.currentKey.value).toBe(groupRowKey('a'))

    await press('ArrowLeft')
    expect(close).toHaveBeenCalledTimes(1)

    await press('End')
    await press('ArrowRight')
    expect(activateGroup).toHaveBeenCalledWith('b')
  })

  it('jumps to the ends and pages through the list', async () => {
    await mountList('/images')

    await press('End')
    expect(cursor.currentKey.value).toBe(groupRowKey('b'))

    await press('Home')
    await press('PageDown')
    expect(cursor.currentKey.value).toBe(groupRowKey('b'))
  })
})
