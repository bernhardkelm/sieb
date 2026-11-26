import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'

import type { InboxResponse, ProposalAcceptResponse, ProposalDetail } from '#core/apiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { proposalItem } from '@/__tests__/inboxItemBuilders'
import {
  buildDecisionView,
  buildProposal,
  buildProposalDetail,
} from '@/__tests__/proposalDetailBuilders'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { acceptProposal, fetchProposalDetail, rejectProposal } from '@/api/proposalsApi'
import { CHORD_ARM_DWELL_MS } from '@/composables/useChordArming'
import { ROUTE_NAMES } from '@/router/routeNames'
import { routes } from '@/router/routes'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<typeof markInboxSeen>(),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/proposalsApi', () => ({
  fetchProposalDetail: vi.fn<(id: number) => Promise<ProposalDetail>>(),
  fetchProposals: vi.fn<() => Promise<never[]>>(() => Promise.resolve([])),
  acceptProposal: vi.fn<typeof acceptProposal>(),
  rejectProposal: vi.fn<typeof rejectProposal>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
}))

let layout: WindowLayout
let wrapper: VueWrapper | null = null
let open: InboxItem[] = []

/**
 * Mounts the app routes on the review of the first of six open proposals, the Inbox lists the
 * proposals not accepted yet.
 * @returns {Promise<Router>} - Router once the review rendered
 */
const mountChain = async (): Promise<Router> => {
  open = [1, 2, 3, 4, 5, 6].map((id) => proposalItem(id))

  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes })

  setActivePinia(pinia)
  await router.push('/inbox/proposals/1')
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(RouterView) }),
  })

  wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return router
}

/**
 * Dispatches Cmd+Enter on the focused element, as the browser does, and releases Enter and Meta
 * unless the chord stays held.
 * @param {boolean} repeat - Whether it is a key repeat of a held key
 * @param {boolean} release - Whether Enter and Meta are released afterwards
 * @returns {Promise<void>} - Resolves once settled
 */
const chord = async (repeat = false, release = !repeat): Promise<void> => {
  const target = document.activeElement ?? document.body

  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  )
  await flushPromises()

  if (release) {
    for (const init of [{ key: 'Enter', metaKey: true }, { key: 'Meta' }]) {
      ;(document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keyup', { ...init, bubbles: true }),
      )
    }
    await flushPromises()
  }
}

/**
 * Dispatches a plain key press on the focused element.
 * @param {string} key - KeyboardEvent key
 * @param {KeyboardEventInit} init - Modifiers
 * @returns {Promise<void>} - Resolves once settled
 */
const press = async (key: string, init: KeyboardEventInit = {}): Promise<void> => {
  ;(document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
  await flushPromises()
}

/**
 * Arms the accept chord deliberately: the dwell passes and an arrow key scrolls the review.
 * @returns {Promise<void>} - Resolves once settled
 */
const arm = async (): Promise<void> => {
  wait(CHORD_ARM_DWELL_MS)
  await press('ArrowDown')
}

/**
 * Moves the faked clock forward.
 * @param {number} ms - Milliseconds
 * @returns {void}
 */
const wait = (ms: number): void => {
  vi.setSystemTime(Date.now() + ms)
}

/**
 * Returns the ids of the accepted proposals.
 * @returns {number[]} - Ids in call order
 */
const acceptedIds = (): number[] => vi.mocked(acceptProposal).mock.calls.map(([id]) => id)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  layout = stubWindowLayout(32)
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
  vi.mocked(fetchInbox)
    .mockReset()
    .mockImplementation(() =>
      Promise.resolve({
        items: [...open],
        counts: { proposal: open.length, reopened: 0, expiring: 0, kev: 0, total: open.length },
      }),
    )
  vi.mocked(fetchProposalDetail)
    .mockReset()
    .mockImplementation((id) =>
      Promise.resolve(buildProposalDetail({ proposal: buildProposal({ id }) })),
    )
  vi.mocked(acceptProposal)
    .mockReset()
    .mockImplementation((id) => {
      open = open.filter((item) => item.key !== `proposal:${id}`)
      return Promise.resolve({
        proposal: buildProposal({ id, state: 'accepted', resolution: 'accepted' }),
        decisions: [buildDecisionView('not_affected')],
        supersededIds: [],
      } satisfies ProposalAcceptResponse)
    })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  layout.restore()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Inbox proposal accept chain', () => {
  it('accepts one proposal for a held Cmd+Enter, closes the review and focuses the next row', async () => {
    const router = await mountChain()

    await arm()
    await chord(false, false)
    for (let repeat = 0; repeat < 44; repeat += 1) {
      wait(33)
      await chord(true)
    }

    expect(acceptedIds()).toEqual([1])
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(document.querySelector('.proposal-review')).toBeNull()
    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe('proposal:2')
  })

  it('accepts only the first of a double press across the transition', async () => {
    const router = await mountChain()

    await arm()
    await chord()
    wait(300)
    await chord()

    expect(acceptedIds()).toEqual([1])
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe('proposal:2')
  })

  it('accepts nothing from Enter, Cmd+Enter, Cmd+Enter at 150 ms on the next row', async () => {
    const router = await mountChain()

    await arm()
    await chord()
    await press('Enter')
    expect(router.currentRoute.value.params.proposalId).toBe('2')
    for (let press = 0; press < 2; press += 1) {
      wait(150)
      await chord()
    }

    expect(acceptedIds()).toEqual([1])
  })

  it('accepts only the armed proposal when Cmd+Enter and Enter alternate every 30 ms', async () => {
    const router = await mountChain()

    await arm()
    for (let round = 0; round < 20; round += 1) {
      await chord()
      wait(30)
      await press('Enter')
      wait(30)
    }

    expect(acceptedIds()).toEqual([1])
    expect(router.currentRoute.value.params.proposalId).toBe('2')
  })

  it('accepts nothing after j with Meta held, j closes the review until Enter opens one', async () => {
    const router = await mountChain()

    await press('j')
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe('proposal:2')

    await press('Meta', { metaKey: true })
    await press('j', { metaKey: true })
    await chord()
    wait(CHORD_ARM_DWELL_MS)
    await chord()
    expect(acceptedIds()).toEqual([])
    expect(document.querySelector('.proposal-review')).toBeNull()

    await press('Enter')
    expect(router.currentRoute.value.params.proposalId).toBe('2')
    await arm()
    await chord()
    expect(acceptedIds()).toEqual([2])
  })

  it('opens the next review on Enter and arms its chord only after dwell and interaction', async () => {
    const router = await mountChain()

    await arm()
    await chord()
    await press('Enter')
    expect(router.currentRoute.value.params.proposalId).toBe('2')

    wait(300)
    await chord()
    expect(acceptedIds()).toEqual([1])

    await arm()
    await chord()
    expect(acceptedIds()).toEqual([1, 2])
  })
})
