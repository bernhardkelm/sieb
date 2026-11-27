import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import type { InboxResponse } from '#core/apiTypes.ts'
import type { ChecksResponse } from '#core/check.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem } from '@/__tests__/inboxItemBuilders'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { fetchInbox } from '@/api/inboxApi'
import { NO_PROPOSALS, NOTHING_TO_SEE } from '@/components/inbox/inboxBulkTargets'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { routes } from '@/router/routes'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/api/checksApi', () => ({
  fetchChecks: vi.fn<() => Promise<ChecksResponse>>(() => new Promise(() => {})),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/components/overview/OverviewStats.vue', () => ({ default: { render: () => null } }))

const FRESH = proposalItem(1)
const KEV = kevItem(2)
const EXPIRING = expiringItem(3)
const ITEMS: InboxItem[] = [FRESH, KEV, EXPIRING]

let layout: WindowLayout
let wrapper: VueWrapper | null = null

/**
 * Mounts the sidebar next to the Inbox view with the items.
 * @returns {Promise<void>} - Resolves once the Inbox rendered
 */
const mountInbox = async (): Promise<void> => {
  vi.mocked(fetchInbox).mockResolvedValue({
    items: ITEMS,
    counts: { proposal: 1, reopened: 0, expiring: 1, kev: 1, total: ITEMS.length },
  })

  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes })

  setActivePinia(pinia)
  await router.push('/inbox')
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => [h(AppSidebar), h(RouterView)] }),
  })

  wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
}

/**
 * Checks the row of an item with a click on its checkbox.
 * @param {InboxItem} item - Item to check
 * @returns {Promise<void>} - Resolves once settled
 */
const check = async (item: InboxItem): Promise<void> => {
  document
    .querySelector<HTMLElement>(`[data-inbox-key="${item.key}"] .row-checkbox`)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}

/**
 * Returns the hint button of a key.
 * @param {string} key - Shortcut key
 * @returns {HTMLButtonElement} - Hint button
 */
const hintOf = (key: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>('.hints button')].find(
    (button) => button.querySelector('.key-hint')?.textContent === key,
  )!

/**
 * Returns the visible label and the accessible label of a hint.
 * @param {string} key - Shortcut key
 * @returns {[string, string | undefined]} - Visible label, accessible label when it differs
 */
const labelOf = (key: string): [string, string | undefined] => {
  const button = hintOf(key)

  return [
    button.querySelector(':scope > span:last-child')!.textContent!,
    button.querySelector('.visually-hidden')?.textContent ?? undefined,
  ]
}

beforeEach(() => {
  layout = stubWindowLayout(32)
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  layout.restore()
  document.body.innerHTML = ''
})

describe('AppSidebar counts on the Inbox', () => {
  it('keeps the plain labels without checked items and counts what each action acts on', async () => {
    await mountInbox()

    expect(labelOf('a')).toEqual(['Accept', undefined])
    expect(labelOf('d')).toEqual(['Reject', undefined])
    expect(labelOf('s')).toEqual(['Mark as seen', undefined])

    await check(FRESH)
    await check(KEV)

    expect(labelOf('a')).toEqual(['Accept 1', 'Accept 1 proposal'])
    expect(hintOf('a').title).toBe(`1 of 2 selected. ${NO_PROPOSALS}.`)
    expect(labelOf('d')).toEqual(['Reject 1', 'Reject 1 proposal'])
    expect(labelOf('s')).toEqual(['Mark as seen 1', 'Mark as seen 1 item'])
    expect(hintOf('s').title).toBe(`1 of 2 selected. ${NOTHING_TO_SEE}.`)

    await check(EXPIRING)

    expect(labelOf('s')).toEqual(['Mark as seen 2', 'Mark as seen 2 items'])
  })
})
