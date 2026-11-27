import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TooltipProvider } from 'reka-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import type { InboxResponse } from '#core/inboxApiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import { visibleText } from '@/__tests__/visibleText'
import { stubWindowLayout, type WindowLayout } from '@/__tests__/windowLayout'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { bulkAcceptProposals, bulkRejectProposals } from '@/api/proposalBulkApi'
import { NO_PROPOSALS, NONE_ACCEPTABLE, NOTHING_TO_SEE } from '@/components/inbox/inboxBulkTargets'
import { routes } from '@/router/routes'
import { notifyNotice, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<typeof markInboxSeen>(),
}))
vi.mock('@/api/proposalBulkApi', () => ({
  bulkAcceptProposals: vi.fn<typeof bulkAcceptProposals>(),
  bulkRejectProposals: vi.fn<typeof bulkRejectProposals>(),
}))
vi.mock('@/api/labelsApi', () => ({
  fetchLabels: vi.fn<() => Promise<never>>(() => new Promise(() => {})),
}))
vi.mock('@/toast/toastManager', () => ({
  notifyError: vi.fn<(title: string, error: unknown) => void>(),
  notifySuccess: vi.fn<(title: string, description?: string) => void>(),
  notifyNotice: vi.fn<(title: string, description?: string) => void>(),
}))

const IMAGE = 'index.docker.io/library/nginx'
const FRESH = proposalItem(1, {
  currentDecisionIds: [{ imageRef: IMAGE, decisionId: 7, updatedAt: '2026-01-01T00:00:00.000Z' }],
})
const OUTDATED = proposalItem(5, { outdated: true })
const INCONCLUSIVE = proposalItem(6, { verdict: 'inconclusive' as typeof FRESH.verdict })
const KEV = kevItem(4)
const EXPIRING = expiringItem(3)
const ITEMS: InboxItem[] = [FRESH, reopenedItem(2), KEV, OUTDATED, INCONCLUSIVE, EXPIRING]

let layout: WindowLayout
let wrapper: VueWrapper | null = null

/**
 * Answers the Inbox with items.
 * @param {InboxItem[]} items - Items the API returns
 * @returns {void}
 */
const answerInbox = (items: InboxItem[]): void => {
  vi.mocked(fetchInbox).mockResolvedValue({
    items,
    counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: items.length },
  })
}

/**
 * Mounts the Inbox with the items.
 * @returns {Promise<void>} - Resolves once the Inbox rendered
 */
const mountInbox = async (): Promise<void> => {
  answerInbox(ITEMS)

  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes })

  setActivePinia(pinia)
  await router.push('/inbox')
  await router.isReady()

  const host = defineComponent({
    setup: () => () => h(TooltipProvider, null, { default: () => h(RouterView) }),
  })

  wrapper = mount(host, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
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
 * Checks the rows of items with a click on their checkbox.
 * @param {InboxItem[]} items - Items to check
 * @returns {Promise<void>} - Resolves once settled
 */
const check = async (...items: InboxItem[]): Promise<void> => {
  for (const item of items) {
    document
      .querySelector<HTMLElement>(`[data-inbox-key="${item.key}"] .row-checkbox`)!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
  }
}

/**
 * Returns the button with a visible label, inside a container.
 * @param {string} label - Visible text
 * @param {string} within - Selector of the container
 * @returns {HTMLButtonElement} - Button
 */
const buttonOf = (label: string, within = 'body'): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>(`${within} button`)].find(
    (button) => visibleText(button) === label,
  )!

/**
 * Returns the checked item keys.
 * @returns {string[]} - Keys in list order
 */
const checkedKeys = (): string[] =>
  [...document.querySelectorAll('.list-row.checked')].map((row) =>
    row.getAttribute('data-inbox-key')!,
  )

beforeEach(() => {
  layout = stubWindowLayout(32)
  HTMLElement.prototype.scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>()
  vi.mocked(notifySuccess).mockClear()
  vi.mocked(notifyNotice).mockClear()
  vi.mocked(bulkAcceptProposals).mockReset()
  vi.mocked(bulkRejectProposals).mockReset()
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

describe('InboxView bulk actions', () => {
  it('selects every item but the re-opened decision from the selection bar', async () => {
    await mountInbox()
    await check(KEV)

    buttonOf('Select all', '[role="toolbar"]').click()
    await flushPromises()

    expect(checkedKeys()).toEqual(
      [FRESH, KEV, OUTDATED, INCONCLUSIVE, EXPIRING].map((item) => item.key),
    )
    expect(document.querySelector('[role="toolbar"]')?.textContent).toContain('5 selected')
  })

  it('accepts the checked proposals after the dialog and keeps the skipped ones checked', async () => {
    await mountInbox()
    await check(FRESH, KEV, OUTDATED, INCONCLUSIVE)
    vi.mocked(bulkAcceptProposals).mockResolvedValue([
      { id: 1, vulnId: FRESH.vulnId, outcome: 'accepted' },
      { id: 5, vulnId: OUTDATED.vulnId, outcome: 'outdated' },
      { id: 6, vulnId: INCONCLUSIVE.vulnId, outcome: 'inconclusive' },
    ])

    await press('a')

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Accept 1 proposal?')
    expect(document.querySelector('.skip-note')?.textContent).toBe(
      'Skipped: 1 outdated, 1 inconclusive. They stay selected, review them one by one.',
    )

    answerInbox(ITEMS.filter((item) => item !== FRESH))
    buttonOf('Accept 1', '[role="dialog"]').click()
    await flushPromises()

    expect(bulkAcceptProposals).toHaveBeenCalledExactlyOnceWith([
      { id: 1, expectedDecisionIds: FRESH.currentDecisionIds },
      { id: 5, expectedDecisionIds: OUTDATED.currentDecisionIds },
      { id: 6, expectedDecisionIds: INCONCLUSIVE.currentDecisionIds },
    ])
    expect(notifySuccess).toHaveBeenCalledExactlyOnceWith(
      'Accepted 1, skipped 2 (1 outdated, 1 inconclusive)',
      `${OUTDATED.vulnId} outdated, ${INCONCLUSIVE.vulnId} inconclusive`,
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(checkedKeys()).toEqual([KEV.key, OUTDATED.key, INCONCLUSIVE.key])
  })

  it('rejects the checked proposals with one reason from the summary button', async () => {
    await mountInbox()
    await check(FRESH, OUTDATED)
    vi.mocked(bulkRejectProposals).mockResolvedValue([
      { id: 1, vulnId: FRESH.vulnId, outcome: 'rejected' },
      { id: 5, vulnId: OUTDATED.vulnId, outcome: 'rejected' },
    ])

    buttonOf('Reject 2', '.list-summary').click()
    await flushPromises()

    const dialog = document.querySelector('[role="dialog"]')!
    const reason = dialog.querySelector('textarea')!

    expect(dialog.textContent).toContain('Reject 2 proposals?')

    reason.value = 'Parser reachable through the upload endpoint'
    reason.dispatchEvent(new Event('input'))
    answerInbox(ITEMS.filter((item) => item !== FRESH && item !== OUTDATED))
    buttonOf('Reject 2', '[role="dialog"]').click()
    await flushPromises()

    expect(bulkRejectProposals).toHaveBeenCalledExactlyOnceWith(
      [1, 5],
      'Parser reachable through the upload endpoint',
    )
    expect(notifySuccess).toHaveBeenCalledExactlyOnceWith('Rejected 2', undefined)
    expect(checkedKeys()).toEqual([])
  })

  it('marks the checked expiring and KEV items as seen in one toast', async () => {
    await mountInbox()
    await check(FRESH, KEV, EXPIRING)

    buttonOf('Mark seen 2', '[role="toolbar"]').click()
    await flushPromises()

    expect(markInboxSeen).toHaveBeenCalledExactlyOnceWith([KEV.key, EXPIRING.key])
    expect(notifySuccess).toHaveBeenCalledExactlyOnceWith('Marked 2 as seen', undefined)
    expect(checkedKeys()).toEqual([FRESH.key])
  })

  it('disables the actions that do not apply to the selection with a reason', async () => {
    await mountInbox()
    await check(KEV)

    const accept = buttonOf('Accept', '[role="toolbar"]')

    expect(accept.getAttribute('aria-disabled')).toBe('true')
    expect(accept.title).toBe(NO_PROPOSALS)
    expect(buttonOf('Reject', '.list-summary').title).toBe(NO_PROPOSALS)
    expect(buttonOf('Mark seen 1', '[role="toolbar"]').hasAttribute('aria-disabled')).toBe(false)

    await press('a')
    expect(notifyNotice).toHaveBeenCalledExactlyOnceWith('Not available', NO_PROPOSALS)
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    await check(KEV, OUTDATED, INCONCLUSIVE)

    expect(buttonOf('Accept', '[role="toolbar"]').title).toBe(NONE_ACCEPTABLE)
    expect(buttonOf('Reject 2', '[role="toolbar"]').hasAttribute('aria-disabled')).toBe(false)
    expect(buttonOf('Mark seen', '[role="toolbar"]').title).toBe(NOTHING_TO_SEE)

    await press('s')
    expect(markInboxSeen).not.toHaveBeenCalled()
  })

  it('counts the items each action acts on and names the skipped ones', async () => {
    await mountInbox()
    await check(FRESH, KEV, OUTDATED, EXPIRING)

    for (const within of ['[role="toolbar"]', '.list-summary']) {
      const accept = buttonOf('Accept 1', within)
      const reject = buttonOf('Reject 2', within)
      const seen = buttonOf('Mark seen 2', within)

      expect(accept.getAttribute('aria-label')).toBe('Accept 1 proposal')
      expect(accept.title).toBe(`1 of 4 selected. ${NO_PROPOSALS}. ${NONE_ACCEPTABLE}.`)
      expect(reject.getAttribute('aria-label')).toBe('Reject 2 proposals')
      expect(reject.title).toBe(`2 of 4 selected. ${NO_PROPOSALS}.`)
      expect(seen.getAttribute('aria-label')).toBe('Mark seen 2 items')
      expect(seen.title).toBe(`2 of 4 selected. ${NOTHING_TO_SEE}.`)
    }

    await check(KEV, EXPIRING)

    const reject = buttonOf('Reject 2', '[role="toolbar"]')

    expect(reject.title).toBe('')
    expect(buttonOf('Accept 1', '[role="toolbar"]').title).toBe(
      `1 of 2 selected. ${NONE_ACCEPTABLE}.`,
    )
  })

  it('reports a batch without writes as a notice', async () => {
    await mountInbox()
    await check(FRESH)
    vi.mocked(bulkAcceptProposals).mockResolvedValue([
      { id: 1, vulnId: FRESH.vulnId, outcome: 'outdated' },
    ])

    await press('a')
    buttonOf('Accept 1', '[role="dialog"]').click()
    await flushPromises()

    expect(notifySuccess).not.toHaveBeenCalled()
    expect(notifyNotice).toHaveBeenCalledExactlyOnceWith(
      'Accepted 0, skipped 1 (outdated)',
      `${FRESH.vulnId} outdated`,
    )
    expect(checkedKeys()).toEqual([FRESH.key])
  })
})
