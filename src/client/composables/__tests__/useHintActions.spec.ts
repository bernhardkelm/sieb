import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useHintActions } from '@/composables/useHintActions'
import { NOT_AVAILABLE_REASON } from '@/keyboard/hintActions'
import { useHintActionsStore } from '@/stores/hintActionsStore'

describe('useHintActions', () => {
  it('registers the actions while the component lives', async () => {
    const pinia = createPinia()
    const run = vi.fn<() => void>()

    setActivePinia(pinia)

    const Host = defineComponent({
      setup: () => {
        useHintActions({ edit: { run } })

        return () => h('div')
      },
    })
    const wrapper = mount(Host, { global: { plugins: [pinia] } })
    const store = useHintActionsStore()

    expect(await store.run('edit')).toBe(true)
    expect(run).toHaveBeenCalledOnce()

    wrapper.unmount()

    expect(store.reasonOf('edit')).toBe(NOT_AVAILABLE_REASON)
  })
})
