import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InboxResponse } from '#core/apiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem } from '@/__tests__/inboxItemBuilders'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { INBOX_POLL_MS, useInboxStore } from '@/stores/inboxStore'
import { notifyError, notifySuccess } from '@/toast/toastManager'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<typeof markInboxSeen>(),
}))
vi.mock('@/toast/toastManager', () => ({
  notifySuccess: vi.fn<typeof notifySuccess>(),
  notifyError: vi.fn<typeof notifyError>(),
}))

/**
 * Builds an Inbox answer, the counts as the server computes them.
 * @param {InboxItem[]} items - Items
 * @returns {InboxResponse} - Answer
 */
const answer = (items: InboxItem[]): InboxResponse => ({
  items,
  counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: items.length },
})

/**
 * Sets the visibility of the page.
 * @param {DocumentVisibilityState} state - Visibility
 * @returns {void}
 */
const setVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

const ITEMS = [proposalItem(1), kevItem(2), expiringItem(3)]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchInbox).mockReset().mockResolvedValue(answer(ITEMS))
  vi.mocked(markInboxSeen).mockReset()
  vi.mocked(notifySuccess).mockReset()
  vi.mocked(notifyError).mockReset()
  setVisibility('visible')
})

afterEach(() => {
  useInboxStore().stopPolling()
  vi.useRealTimers()
})

describe('inboxStore', () => {
  it('loads the items and counts them per kind', async () => {
    const store = useInboxStore()

    await store.ensureLoaded()

    expect(store.loaded).toBe(true)
    expect(store.items.map((item) => item.key)).toEqual(['proposal:1', 'kev:2', ITEMS[2]!.key])
    expect(store.counts).toEqual({ proposal: 1, reopened: 0, expiring: 1, kev: 1, total: 3 })
  })

  it('refetches when the data version moves', async () => {
    const store = useInboxStore()

    await store.ensureLoaded()
    vi.mocked(fetchInbox).mockResolvedValue(answer([proposalItem(1)]))
    useDataVersionStore().bump()
    await vi.waitFor(() => expect(store.counts.total).toBe(1))
  })

  it('polls every 30 seconds while visible and catches up when the tab returns', async () => {
    vi.useFakeTimers()
    const store = useInboxStore()

    store.startPolling()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchInbox).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INBOX_POLL_MS)
    expect(fetchInbox).toHaveBeenCalledTimes(2)

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(INBOX_POLL_MS * 3)
    expect(fetchInbox).toHaveBeenCalledTimes(2)

    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchInbox).toHaveBeenCalledTimes(3)
  })

  it('removes seen items at once, sends only seeable keys and confirms with a toast', async () => {
    let resolve: (() => void) | null = null
    vi.mocked(markInboxSeen).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = () => done({ counts: answer([]).counts, ignored: [] })
        }),
    )
    const store = useInboxStore()

    await store.ensureLoaded()
    const marking = store.markSeen(['proposal:1', 'kev:2', ITEMS[2]!.key])

    expect(store.items.map((item) => item.key)).toEqual(['proposal:1'])
    expect(markInboxSeen).toHaveBeenCalledExactlyOnceWith(['kev:2', ITEMS[2]!.key])

    await store.refresh()
    expect(store.items.map((item) => item.key)).toEqual(['proposal:1'])

    resolve!()
    await expect(marking).resolves.toBe(true)
    expect(notifySuccess).toHaveBeenCalledExactlyOnceWith('Marked 2 items as seen', undefined)
  })

  it('names the CVE of a single seen item', async () => {
    vi.mocked(markInboxSeen).mockResolvedValue({ counts: answer([]).counts, ignored: [] })
    const store = useInboxStore()

    await store.ensureLoaded()
    await store.markSeen(['kev:2'])

    expect(notifySuccess).toHaveBeenCalledExactlyOnceWith('Marked as seen', 'CVE-2025-4002')
  })

  it('puts the items back in Inbox order when the server refuses', async () => {
    vi.mocked(markInboxSeen).mockRejectedValue(new Error('offline'))
    const store = useInboxStore()

    await store.ensureLoaded()
    await expect(store.markSeen(['kev:2'])).resolves.toBe(false)

    expect(store.items.map((item) => item.key)).toEqual(['proposal:1', 'kev:2', ITEMS[2]!.key])
    expect(notifyError).toHaveBeenCalledOnce()
  })

  it('ignores proposals, which leave by being handled', async () => {
    const store = useInboxStore()

    await store.ensureLoaded()
    await expect(store.markSeen(['proposal:1'])).resolves.toBe(false)

    expect(markInboxSeen).not.toHaveBeenCalled()
    expect(store.items).toHaveLength(3)
  })
})
