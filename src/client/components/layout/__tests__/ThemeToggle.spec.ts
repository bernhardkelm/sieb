import { mount } from '@vue/test-utils'
import { TooltipProvider } from 'reka-ui'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import { THEME_STORAGE_KEY, useTheme } from '@/composables/useTheme'

const Harness = defineComponent({
  render: () => h(TooltipProvider, null, () => h(ThemeToggle)),
})

afterEach(() => {
  useTheme().setTheme('auto')
})

describe('ThemeToggle', () => {
  it('applies and stores the chosen theme', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    const dark = wrapper.get('[aria-label="Dark theme"]')

    await dark.trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(dark.attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('keeps the choice when the active item is clicked again', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    const light = wrapper.get('[aria-label="Light theme"]')

    await light.trigger('click')
    await light.trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    wrapper.unmount()
  })
})
