import type { RouteRecordRaw } from 'vue-router'

import { legacyFindingLink } from '@/router/legacyFindingLink'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: ROUTE_NAMES.INBOX },
  },
  {
    path: '/inbox',
    name: ROUTE_NAMES.INBOX,
    component: () => import('@/views/InboxView.vue'),
    meta: { title: 'Inbox' },
    beforeEnter: legacyFindingLink,
    children: [
      {
        path: `proposals/:${PROPOSAL_PARAM}(\\d+)`,
        name: ROUTE_NAMES.INBOX_PROPOSAL,
        component: () => import('@/components/proposals/ProposalReview.vue'),
        props: (route) => ({ proposalId: Number(route.params[PROPOSAL_PARAM]) }),
      },
    ],
  },
  {
    path: '/triage',
    name: ROUTE_NAMES.TRIAGE,
    component: () => import('@/views/TriageView.vue'),
    meta: { title: 'Triage' },
  },
  {
    path: '/images',
    name: ROUTE_NAMES.IMAGES,
    component: () => import('@/views/ImagesView.vue'),
    meta: { title: 'By image' },
  },
  {
    path: '/cves',
    name: ROUTE_NAMES.CVES,
    component: () => import('@/views/CvesView.vue'),
    meta: { title: 'By CVE' },
  },
  {
    path: '/decisions',
    name: ROUTE_NAMES.DECISIONS,
    component: () => import('@/views/DecisionsView.vue'),
    meta: { title: 'Decisions' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: ROUTE_NAMES.INBOX, params: {} },
  },
]
