import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { defineComponent, h, type Component } from 'vue'

/**
 * Mounts a component inside the tooltip provider the app shell provides, with a fresh Pinia.
 * @param {Component} component - Component under test
 * @param {Record<string, unknown>} props - Its props, listeners as onX entries
 * @returns {VueWrapper} - Wrapper of the provider host
 */
export const mountWithProviders = (
  component: Component,
  props: Record<string, unknown>,
): VueWrapper => {
  const pinia = createPinia()

  setActivePinia(pinia)

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(component, props) }),
  })

  return mount(host, { global: { plugins: [pinia] }, attachTo: document.body })
}
