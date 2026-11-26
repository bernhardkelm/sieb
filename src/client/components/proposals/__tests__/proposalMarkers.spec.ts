import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { ProposalListItem } from '#core/apiTypes.ts'
import { mountWithProviders } from '@/__tests__/mountWithProviders'
import { buildProposalItem, IMAGE, OWN_IMAGE } from '@/__tests__/proposalDetailBuilders'
import { fetchProposals } from '@/api/proposalsApi'
import FindingDecisions from '@/components/finding/FindingDecisions.vue'
import FindingRow from '@/components/finding/FindingRow.vue'
import { PROPOSAL_PARAM, ROUTE_NAMES } from '@/router/routeNames'
import { useDataVersionStore } from '@/stores/dataVersionStore'

vi.mock('@/api/proposalsApi', () => ({
  fetchProposals: vi.fn<() => Promise<ProposalListItem[]>>(),
  fetchProposalDetail: vi.fn<() => Promise<never>>(),
  acceptProposal: vi.fn<() => Promise<never>>(),
  rejectProposal: vi.fn<() => Promise<never>>(),
}))

let wrapper: VueWrapper | null = null

/**
 * Mounts two Triage rows, one per image.
 * @returns {Promise<VueWrapper>} - Host of both rows
 */
const mountRows = async (): Promise<VueWrapper> => {
  const host = defineComponent({
    setup: () => () =>
      [IMAGE, OWN_IMAGE].map((imageRef, index) =>
        h(FindingRow, {
          finding: buildFindingView({ id: index + 1, imageRef }),
          current: false,
          checked: false,
          isNew: false,
        }),
      ),
  })

  wrapper = mountWithProviders(host, {})
  await flushPromises()
  return wrapper
}

/**
 * Returns the proposal chip texts per row.
 * @returns {(string | null)[]} - Text of the title chip per row, null without one
 */
const chips = (): (string | null)[] =>
  [...document.body.querySelectorAll('[data-finding-id]')].map(
    (row) => row.querySelector('.title .proposal-chip')?.textContent?.trim() ?? null,
  )

beforeEach(() => {
  vi.mocked(fetchProposals).mockReset().mockResolvedValue([buildProposalItem()])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('proposal markers', () => {
  it('marks the Triage rows an open proposal covers, with one request for all rows', async () => {
    await mountRows()

    expect(chips()).toEqual(['Proposed · Not affected', null])
    expect(fetchProposals).toHaveBeenCalledExactlyOnceWith('open')
  })

  it('marks every image for a proposal on all images and refetches with the data version', async () => {
    await mountRows()
    vi.mocked(fetchProposals).mockResolvedValue([
      buildProposalItem({
        scope: 'all',
        imageRefs: null,
        verdict: 'needs_patch',
        justification: null,
      }),
    ])

    useDataVersionStore().bump()
    await flushPromises()

    expect(chips()).toEqual(['Proposed · Needs patch', 'Proposed · Needs patch'])
    expect(fetchProposals).toHaveBeenCalledTimes(2)
  })

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
