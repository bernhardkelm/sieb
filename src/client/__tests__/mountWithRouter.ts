import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ROUTE_NAMES } from '@/router/routeNames'

export interface RoutedMount {
  wrapper: VueWrapper
  router: Router
}

/**
 * Mounts a component on a memory router at a path, inside the tooltip provider, with a fresh
 * Pinia, for components and composables that read query params.
 * @param {Component} component - Component under test
 * @param {string} path - Starting path with query string
 * @returns {Promise<RoutedMount>} - Wrapper and router, once the router is ready
 */
export const mountWithRouter = async (component: Component, path: string): Promise<RoutedMount> => {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: Object.values(ROUTE_NAMES).map((name) => ({
      path: `/${name}`,
      name,
      component: { render: () => null },
    })),
  })

  setActivePinia(pinia)
  await router.push(path)
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(component) }),
  })
  const wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })

  return { wrapper, router }
}
