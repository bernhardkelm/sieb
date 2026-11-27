import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'

import type { InboxResponse } from '#core/inboxApiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import { visibleText } from '@/__tests__/visibleText'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { bulkAcceptProposals } from '@/api/proposalBulkApi'
import { routes } from '@/router/routes'
import { useLabelsStore } from '@/stores/labelsStore'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<typeof markInboxSeen>(),
}))
vi.mock('@/api/proposalBulkApi', () => ({
  bulkAcceptProposals: vi.fn<typeof bulkAcceptProposals>(),
  bulkRejectProposals: vi.fn<() => Promise<never>>(),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/components/proposals/ProposalReview.vue', async () => {
  const vue = await import('vue')

  return {
    default: vue.defineComponent({
      props: { proposalId: { type: Number, required: true } },
      setup: (props) => () => vue.h('aside', { class: 'review', 'data-id': props.proposalId }),
    }),
  }
})
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

const OWN = proposalItem(1, { owners: ['self'], exposure: 'public', packages: ['libssl3'] })
const THIRD = proposalItem(5, { owners: ['third-party'], severity: 'Low' })
const REOPENED = reopenedItem(2, { owners: ['self'] })
const KEV = kevItem(4, { owners: ['self'], namespaces: ['shop'] })
const EXPIRING = expiringItem(3, { owners: ['third-party'] })
const ITEMS: InboxItem[] = [OWN, REOPENED, KEV, THIRD, EXPIRING]

let layout: WindowLayout
let wrapper: VueWrapper | null = null

/**
 * Mounts the app routes at a path with the Inbox answering items and every label column shown.
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
  useLabelsStore().data = { exposure: true, owners: ['self', 'third-party'], kev: 'cisa' }
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
 * Returns the keys of the listed rows.
 * @returns {string[]} - Item keys in list order
 */
const rowKeys = (): string[] =>
  [...document.querySelectorAll('[data-inbox-key]')].map((row) =>
    row.getAttribute('data-inbox-key')!,
  )

/**
 * Returns the text of the list summary.
 * @returns {string} - Summary text without the shortcut hints
 */
const summary = (): string => visibleText(document.querySelector('.list-summary .text')!)

/**
 * Returns the button with a visible label, inside a container.
 * @param {string} label - Visible text
 * @param {string} within - Selector of the container
 * @returns {HTMLButtonElement | undefined} - Button, undefined when absent
 */
const buttonOf = (label: string, within = 'body'): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>(`${within} button`)].find(
    (button) => visibleText(button) === label,
  )

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
 * Types into the Inbox search.
 * @param {string} text - Search text
 * @returns {Promise<void>} - Resolves once settled
 */
const search = async (text: string): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('.inbox-view input[type="search"]')!

  input.value = text
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

beforeEach(() => {
  layout = stubWindowLayout(32)
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
  vi.mocked(bulkAcceptProposals).mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  layout.restore()
  document.body.innerHTML = ''
})

describe('InboxView filters', () => {
  it('restores the filters of a link, ignores invalid values and counts the shown items', async () => {
    await mountInbox('/inbox?kind=proposal,bogus&sev=severe')

    expect(rowKeys()).toEqual([OWN.key, THIRD.key])
    expect(summary()).toBe('2 of 5 items · 2 proposals')
  })

  it('narrows by each filter of the bar', async () => {
    const cases: [string, InboxItem[]][] = [
      ['q=libssl', [OWN]],
      ['q=shop', [KEV]],
      ['sev=low', [THIRD]],
      ['exp=public', [OWN]],
      ['owner=third-party', [THIRD, EXPIRING]],
      ['kev=1', [KEV]],
      ['kind=expiring,reopened', [REOPENED, EXPIRING]],
    ]

    for (const [query, expected] of cases) {
      await mountInbox(`/inbox?${query}`)
      expect({ query, keys: rowKeys() }).toEqual({ query, keys: expected.map((item) => item.key) })
      wrapper?.unmount()
    }

    wrapper = null
  })

  it('writes a changed filter into the query by replacing the entry, keeping other params', async () => {
    const router = await mountInbox('/inbox?from=mail')
    const push = vi.spyOn(router, 'push')
    const replace = vi.spyOn(router, 'replace')

    await search('libssl')

    expect(router.currentRoute.value.query).toEqual({ from: 'mail', q: 'libssl' })
    expect(replace).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(rowKeys()).toEqual([OWN.key])
    expect(summary()).toBe('1 of 5 items · 1 proposal')
  })

  it('keeps the filters while a proposal review is open', async () => {
    const router = await mountInbox('/inbox?owner=self')

    await press('Enter')

    expect(router.currentRoute.value.path).toBe(`/inbox/proposals/${OWN.refs.proposalId}`)
    expect(router.currentRoute.value.query).toEqual({ owner: 'self' })
    expect(document.querySelector('.review')?.getAttribute('data-id')).toBe('1')
    expect(rowKeys()).toEqual([OWN.key, REOPENED.key, KEV.key])
  })

  it('tells no matches apart from Inbox zero and resets from the empty state', async () => {
    const router = await mountInbox('/inbox?q=nothing-matches')

    expect(document.querySelector('.empty-state .title')?.textContent).toBe('No matches')
    expect(document.querySelector('.all-clear')).toBeNull()
    expect(summary()).toBe('0 of 5 items')

    buttonOf('Reset filters', '.empty-state')!.click()
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({})
    expect(rowKeys()).toEqual(ITEMS.map((item) => item.key))
  })

  it('shows Inbox zero for an empty Inbox also while filters are set', async () => {
    await mountInbox('/inbox?kind=proposal', [])

    expect(document.querySelector('.all-clear h2')?.textContent).toBe('Inbox zero')
    expect(document.querySelector('.empty-state')).toBeNull()
  })

  it('selects all and accepts among the filtered rows only', async () => {
    const router = await mountInbox('/inbox?owner=self')

    document
      .querySelector<HTMLElement>(`[data-inbox-key="${KEV.key}"] .row-checkbox`)!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    buttonOf('Select all', '[role="toolbar"]')!.click()
    await flushPromises()

    expect([...document.querySelectorAll('.list-row.checked')].length).toBe(2)

    await router.replace('/inbox?owner=self&kind=proposal')
    await flushPromises()
    vi.mocked(bulkAcceptProposals).mockResolvedValue([
      { id: 1, vulnId: OWN.vulnId, outcome: 'accepted' },
    ])
    await press('a')
    buttonOf('Accept 1', '[role="dialog"]')!.click()
    await flushPromises()

    expect(bulkAcceptProposals).toHaveBeenCalledExactlyOnceWith([
      { id: 1, expectedDecisionIds: OWN.currentDecisionIds },
    ])
  })

  it('focuses the search with /, the list keys still move the cursor after Escape', async () => {
    await mountInbox('/inbox')
    const input = document.querySelector<HTMLInputElement>('.inbox-view input[type="search"]')!

    await press('/')

    expect(document.activeElement).toBe(input)

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await press('j')

    expect(document.activeElement?.getAttribute('data-inbox-key')).toBe(REOPENED.key)
  })
})
