import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ROUTE_NAMES } from '@/router/routeNames'
import { routes } from '@/router/routes'

vi.mock('@/views/InboxView.vue', () => ({ default: { render: () => null } }))
vi.mock('@/views/TriageView.vue', () => ({ default: { render: () => null } }))
vi.mock('@/components/proposals/ProposalReview.vue', () => ({ default: { render: () => null } }))

/**
 * Creates a router on the app routes and loads a first path, as a page load does.
 * @param {string} path - Path with query string
 * @returns {Promise<Router>} - Router after the first navigation
 */
const loadAt = async (path: string): Promise<Router> => {
  const router = createRouter({ history: createMemoryHistory(), routes })

  await router.push(path)
  await router.isReady()
  return router
}

describe('routes', () => {
  it('opens Triage at the root and for unknown paths, the Inbox on its own path', async () => {
    expect((await loadAt('/')).currentRoute.value.name).toBe(ROUTE_NAMES.TRIAGE)
    expect((await loadAt('/nowhere')).currentRoute.value.name).toBe(ROUTE_NAMES.TRIAGE)
    expect((await loadAt('/inbox')).currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
  })

  it('sends a 0.1.0 finding link on the inbox to Triage with its query', async () => {
    const router = await loadAt('/inbox?finding=7&q=openssl')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.TRIAGE)
    expect(router.currentRoute.value.fullPath).toBe('/triage?finding=7&q=openssl')
  })

  it('opens the finding panel over the Inbox once the app runs', async () => {
    const router = await loadAt('/inbox')

    await router.replace('/inbox?finding=7')

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(router.currentRoute.value.query.finding).toBe('7')
  })

  it('opens a proposal deep link in the review panel of the Inbox', async () => {
    const router = await loadAt('/inbox/proposals/12')
    const route = router.currentRoute.value
    const panel = route.matched.at(-1)!

    expect(route.name).toBe(ROUTE_NAMES.INBOX_PROPOSAL)
    expect(route.matched[0]?.name).toBe(ROUTE_NAMES.INBOX)
    expect(route.meta.title).toBe('Inbox')
    expect(typeof panel.props.default === 'function' && panel.props.default(route)).toEqual({
      proposalId: 12,
    })
  })

  it('sends a proposal path without a numeric id to the Inbox', async () => {
    for (const path of ['/inbox/proposals/abc', '/inbox/proposals', '/inbox/proposals/12/x']) {
      const route = (await loadAt(path)).currentRoute.value

      expect(route.name).toBe(ROUTE_NAMES.INBOX)
      expect(route.fullPath).toBe('/inbox')
    }
  })
})
