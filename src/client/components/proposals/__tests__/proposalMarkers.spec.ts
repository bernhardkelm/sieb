import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { ProposalListItem } from '#core/apiTypes.ts'
import { buildProposalItem, IMAGE } from '@/__tests__/proposalDetailBuilders'
import { fetchProposals } from '@/api/proposalsApi'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'

vi.mock('@/api/proposalsApi', () => ({
  fetchProposals: vi.fn<() => Promise<ProposalListItem[]>>(),
  fetchProposalDetail: vi.fn<() => Promise<never>>(),
  acceptProposal: vi.fn<() => Promise<never>>(),
  rejectProposal: vi.fn<() => Promise<never>>(),
}))

let wrapper: VueWrapper | null = null

beforeEach(() => {
  vi.mocked(fetchProposals).mockReset().mockResolvedValue([buildProposalItem()])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('proposal notice', () => {
  it('links the open proposal from the decision section of the finding panel', async () => {
    const finding = buildFindingView({ id: 1, imageRef: IMAGE })
    const host = defineComponent({
      setup: () => () =>
        h(FindingDecisions, {
          detail: { finding, instances: [], decisions: [], events: [], kev: null },
        }),
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: host },
        {
          path: `/inbox/proposals/:${PROPOSAL_PARAM}`,
          name: ROUTE_NAMES.INBOX_PROPOSAL,
          component: { render: () => null },
        },
      ],
    })

    await router.push('/')
    wrapper = mount(
      defineComponent({ setup: () => () => h(TooltipProvider, null, () => h(RouterView)) }),
      { global: { plugins: [createPinia(), router] }, attachTo: document.body },
    )
    await flushPromises()

    const notice = document.body.querySelector<HTMLElement>('.proposal-notice')!
    const link = notice.querySelector<HTMLAnchorElement>('a')!

    expect(notice.textContent).toContain('Claude proposed')
    expect(notice.textContent).toContain('Not affected')
    expect(link.textContent).toContain('Open review')
    expect(link.getAttribute('href')).toBe('/inbox/proposals/7')
  })
})
