import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'
import { useInboxStore } from '@/stores/inboxStore'

export interface MarkerMount {
  wrapper: VueWrapper
  router: Router
}

const stub = { render: () => null }

/**
 * Mounts a component on Triage of a memory router that knows the Inbox routes, with the Inbox
 * store holding items.
 * @param {Component} component - Component rendered on Triage
 * @param {InboxItem[]} items - Inbox items
 * @returns {Promise<MarkerMount>} - Wrapper and router once rendered
 */
export const mountOnTriage = async (
  component: Component,
  items: InboxItem[],
): Promise<MarkerMount> => {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/triage', name: ROUTE_NAMES.TRIAGE, component },
      {
        path: '/inbox',
        name: ROUTE_NAMES.INBOX,
        component: stub,
        children: [
          {
            path: `proposals/:${PROPOSAL_PARAM}`,
            name: ROUTE_NAMES.INBOX_PROPOSAL,
            component: stub,
          },
        ],
      },
    ],
  })

  setActivePinia(pinia)
  useInboxStore().items = items
  await router.push('/triage')
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(RouterView) }),
  })
  const wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })

  await flushPromises()
  return { wrapper, router }
}
