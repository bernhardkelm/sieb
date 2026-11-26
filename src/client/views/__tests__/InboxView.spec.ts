import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'

import type { InboxResponse } from '#core/apiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { ROUTE_NAMES } from '@/router/routeNames'
import { routes } from '@/router/routes'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<typeof markInboxSeen>(),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/components/proposals/ProposalReview.vue', async () => {
  const vue = await import('vue')

  return {
    default: vue.defineComponent({
      props: { proposalId: { type: Number, required: true } },
      emits: ['resolved', 'close'],
      setup:
        (props, { emit }) =>
        () =>
          vue.h('aside', { class: 'review', 'data-id': props.proposalId }, [
            vue.h('button', { class: 'resolve', onClick: () => emit('resolved') }),
            vue.h('button', { class: 'close', onClick: () => emit('close') }),
          ]),
    }),
  }
})

const KEV = kevItem(4)
const EXPIRING = expiringItem(3)
const ITEMS: InboxItem[] = [proposalItem(1), reopenedItem(2), KEV, proposalItem(5), EXPIRING]

let layout: WindowLayout
let wrapper: VueWrapper | null = null

/**
 * Mounts the app routes at a path with the Inbox answering items.
 * @param {string} path - Starting path
 * @param {InboxItem[]} items - Items the API returns
 * @returns {Promise<Router>} - Router once the Inbox rendered
 */
const mountInbox = async (path: string, items: InboxItem[] = ITEMS): Promise<Router> => {
  vi.mocked(fetchInbox).mockResolvedValue({
    items,
    counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: items.length },
  })

  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes })

  setActivePinia(pinia)
  await router.push(path)
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(RouterView) }),
  })

  wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return router
}

/**
 * Presses a key on the focused element, as the browser dispatches it to the window.
 * @param {string} key - KeyboardEvent key
 * @returns {Promise<void>} - Resolves once settled
 */
const press = async (key: string): Promise<void> => {
  ;(document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
  await flushPromises()
}

/**
 * Returns the keys of the listed rows.
 * @returns {string[]} - Item keys in list order
 */
const rowKeys = (): string[] =>
  [...document.querySelectorAll('[data-inbox-key]')].map((row) =>
    row.getAttribute('data-inbox-key')!,
  )

beforeEach(() => {
  layout = stubWindowLayout(32)
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
  vi.mocked(markInboxSeen)
    .mockReset()
    .mockResolvedValue({
      counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: 0 },
      ignored: [],
    })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  layout.restore()
  document.body.innerHTML = ''
})

describe('InboxView', () => {
  it('shows the all clear state with links to Triage and Decisions', async () => {
    await mountInbox('/inbox', [])

    expect(document.querySelector('.all-clear h2')?.textContent).toBe('Inbox zero')
    expect(document.querySelector('.all-clear p')?.textContent?.trim()).toBe(
      'Nothing waits for you.',
    )
    expect(
      [...document.querySelectorAll('.all-clear a')].map((link) => link.getAttribute('href')),
    ).toEqual(['/triage', '/decisions'])
  })

  it('lists every kind with a summary of the counts', async () => {
    await mountInbox('/inbox')

    expect(rowKeys()).toEqual(ITEMS.map((item) => item.key))
    expect(document.querySelector('.list-summary')?.textContent).toContain(
      '5 items · 2 proposals · 1 re-opened · 1 expiring · 1 new KEV',
    )
  })

  it('opens a proposal on Enter and a finding item in the finding panel', async () => {
    const router = await mountInbox('/inbox')

    await press('Enter')
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX_PROPOSAL)
    expect(document.querySelector('.review')?.getAttribute('data-id')).toBe('1')

    document.querySelector<HTMLElement>(`[data-inbox-key="${KEV.key}"]`)!.click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(router.currentRoute.value.query.finding).toBe('4')
    expect(document.querySelector('.review')).toBeNull()
  })

  it('mounts the review panel for a proposal deep link and returns focus to its row on close', async () => {
    const router = await mountInbox('/inbox/proposals/5')

    expect(document.querySelector('.review')?.getAttribute('data-id')).toBe('5')
    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe('proposal:5')

    document.querySelector<HTMLElement>('.review .close')!.click()
    await flushPromises()

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(document.querySelector('.review')).toBeNull()
    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe('proposal:5')
  })

  it('closes the review after a resolved proposal and focuses the next row without opening it', async () => {
    const router = await mountInbox('/inbox/proposals/1')

    vi.mocked(fetchInbox).mockResolvedValue({
      items: ITEMS.slice(1),
      counts: { proposal: 1, reopened: 1, expiring: 1, kev: 1, total: 4 },
    })
    document.querySelector<HTMLElement>('.review .resolve')!.click()
    await flushPromises()

    expect(rowKeys()).toEqual(ITEMS.slice(1).map((item) => item.key))
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(router.currentRoute.value.query.finding).toBeUndefined()
    expect(document.querySelector('.review')).toBeNull()
    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe('reopened:2:pending')
  })

  it('still lets the review panel follow a cursor moved by key', async () => {
    const router = await mountInbox('/inbox/proposals/1')

    await press('j')
    await press('j')
    await press('j')

    expect(router.currentRoute.value.params.proposalId).toBe('5')
  })

  it('marks the cursor item as seen with s and from its button', async () => {
    await mountInbox('/inbox')

    await press('s')
    expect(markInboxSeen).not.toHaveBeenCalled()

    await press('j')
    await press('j')
    await press('s')

    expect(markInboxSeen).toHaveBeenCalledExactlyOnceWith([KEV.key])
    expect(rowKeys()).not.toContain(KEV.key)

    document.querySelector<HTMLElement>(`[data-inbox-key="${EXPIRING.key}"] .seen-button`)!.click()
    await flushPromises()

    expect(markInboxSeen).toHaveBeenLastCalledWith([EXPIRING.key])
    expect(rowKeys()).toEqual(['proposal:1', 'reopened:2:pending', 'proposal:5'])
  })

  it('checks only seeable items and marks the checked ones together', async () => {
    await mountInbox('/inbox')

    await press('x')
    expect(document.querySelectorAll('.checked')).toHaveLength(0)

    await press('j')
    await press('j')
    await press('x')
    await press('End')
    await press('x')
    expect(document.querySelector('.list-summary')?.textContent).toContain('2 selected')

    await press('s')

    expect(markInboxSeen).toHaveBeenCalledExactlyOnceWith([KEV.key, EXPIRING.key])
    expect(rowKeys()).toEqual(['proposal:1', 'reopened:2:pending', 'proposal:5'])
  })
})
