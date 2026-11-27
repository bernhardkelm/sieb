import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'

export interface AppRoutesMount {
  wrapper: VueWrapper
  router: Router
}

const EMPTY = { render: () => null }

/**
 * Mounts a component inside the tooltip provider with a fresh Pinia, on a memory router with the
 * app paths of the Checks, Access, Triage, Inbox and proposal routes, so links resolve as in the app.
 * @param {Component} component - Component under test
 * @param {Record<string, unknown>} props - Its props
 * @param {string} path - Starting path
 * @returns {Promise<AppRoutesMount>} - Wrapper and router, once the router is ready
 */
export const mountOnAppRoutes = async (
  component: Component,
  props: Record<string, unknown> = {},
  path = '/checks',
): Promise<AppRoutesMount> => {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/checks', name: ROUTE_NAMES.CHECKS, component: EMPTY },
      { path: '/access', name: ROUTE_NAMES.ACCESS, component: EMPTY },
      { path: '/triage', name: ROUTE_NAMES.TRIAGE, component: EMPTY },
      {
        path: '/inbox',
        name: ROUTE_NAMES.INBOX,
        component: EMPTY,
        children: [
          {
            path: `proposals/:${PROPOSAL_PARAM}(\\d+)`,
            name: ROUTE_NAMES.INBOX_PROPOSAL,
            component: EMPTY,
          },
        ],
      },
    ],
  })

  setActivePinia(pinia)
  await router.push(path)
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(component, props) }),
  })
  const wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })

  return { wrapper, router }
}
