import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { NOT_AVAILABLE_REASON } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('hintActionsStore', () => {
  it('reports unregistered actions as not available and does not run them', async () => {
    const store = useHintActionsStore()

    expect(store.reasonOf('accept')).toBe(NOT_AVAILABLE_REASON)
    expect(await store.run('accept')).toBe(false)
  })

  it('runs a registered action after focusing the view', async () => {
    const store = useHintActionsStore()
    const calls: string[] = []

    store.register({
      actions: { accept: { run: () => calls.push('run') } },
      refocus: async () => {
        calls.push('refocus')
      },
    })

    expect(store.reasonOf('accept')).toBeNull()
    expect(await store.run('accept')).toBe(true)
    expect(calls).toEqual(['refocus', 'run'])
  })

  it('skips the refocus on request', async () => {
    const store = useHintActionsStore()
    const refocus = vi.fn<() => Promise<void>>(async () => {})
    const run = vi.fn<() => void>()

    store.register({ actions: { accept: { run } }, refocus })
    await store.run('accept', false)

    expect(run).toHaveBeenCalledOnce()
    expect(refocus).not.toHaveBeenCalled()
  })

  it('keeps a blocked action from running and follows its availability', async () => {
    const store = useHintActionsStore()
    const cursor = ref<number | null>(null)
    const run = vi.fn<() => void>()

    store.register({
      actions: { toggle: { run, blockedBy: () => (cursor.value === null ? 'No cursor' : null) } },
    })

    expect(store.reasonOf('toggle')).toBe('No cursor')
    expect(await store.run('toggle')).toBe(false)

    cursor.value = 3

    expect(store.reasonOf('toggle')).toBeNull()
    expect(await store.run('toggle')).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('lets the latest registration win and removes only the own one', async () => {
    const store = useHintActionsStore()
    const global = vi.fn<() => void>()
    const view = vi.fn<() => void>()
    const viewRefocus = vi.fn<() => Promise<void>>(async () => {})

    store.register({ actions: { search: { run: global }, sync: { run: global } } })
    const unregister = store.register({ actions: { search: { run: view } }, refocus: viewRefocus })

    await store.run('search')
    await store.run('sync')

    expect(view).toHaveBeenCalledOnce()
    expect(global).toHaveBeenCalledOnce()
    expect(viewRefocus).toHaveBeenCalledTimes(2)

    unregister()
    await store.run('search')

    expect(global).toHaveBeenCalledTimes(2)
    expect(view).toHaveBeenCalledOnce()
  })
})
