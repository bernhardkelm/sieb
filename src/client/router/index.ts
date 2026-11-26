import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { ROUTE_NAMES } from '@/router/routeNames'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: ROUTE_NAMES.INBOX },
  },
  {
    path: '/inbox',
    name: ROUTE_NAMES.INBOX,
    component: () => import('@/views/InboxView.vue'),
    meta: { title: 'Inbox' },
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
    redirect: { name: ROUTE_NAMES.INBOX },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
