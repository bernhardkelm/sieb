import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InboxResponse } from '#core/inboxApiTypes.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import { fetchInbox, markInboxSeen } from '@/api/inboxApi'
import { useDataVersionStore } from '@/stores/dataVersionStore'
import { useInboxStore } from '@/stores/inboxStore'

vi.mock('@/api/inboxApi', () => ({
  fetchInbox: vi.fn<() => Promise<InboxResponse>>(),
  markInboxSeen: vi.fn<typeof markInboxSeen>(),
}))

const VULN = 'CVE-2099-10001'
const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

/**
 * Builds an Inbox answer.
 * @param {InboxItem[]} items - Items
 * @returns {InboxResponse} - Answer
 */
const answer = (items: InboxItem[]): InboxResponse => ({
  items,
  counts: { proposal: 0, reopened: 0, expiring: 0, kev: 0, total: items.length },
})

const ITEMS = [
  proposalItem(1, { vulnId: VULN, imageRefs: null }),
  expiringItem(7, { vulnId: VULN, imageRef: null }),
  kevItem(21, { vulnId: VULN, imageRef: REDIS }),
  reopenedItem(7, { vulnId: VULN, imageRef: null }),
  kevItem(20, { vulnId: VULN }),
  proposalItem(2, { vulnId: 'CVE-2099-10002', imageRefs: null }),
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(fetchInbox).mockReset().mockResolvedValue(answer(ITEMS))
})

describe('inboxStore itemsFor', () => {
  it('returns every kind for a finding, most relevant first, all-images items on each image', async () => {
    const store = useInboxStore()

    await store.ensureLoaded()

    const nginx = store.itemsFor({ id: 20, vulnId: VULN, imageRef: NGINX, decision: { id: 7 } })
    const redis = store.itemsFor({ id: 21, vulnId: VULN, imageRef: REDIS, decision: { id: 7 } })

    expect(nginx.map((item) => item.key)).toEqual([
      'proposal:1',
      'reopened:7:pending',
      'kev:20',
      ITEMS[1]!.key,
    ])
    expect(redis.map((item) => item.key)).toEqual([
      'proposal:1',
      'reopened:7:pending',
      'kev:21',
      ITEMS[1]!.key,
    ])
  })

  it('leaves out decisions that do not govern the finding and follows refetches', async () => {
    const store = useInboxStore()

    await store.ensureLoaded()

    const target = { id: 30, vulnId: VULN, imageRef: NGINX, decision: { id: 8 } }

    expect(store.itemsFor(target).map((item) => item.key)).toEqual(['proposal:1'])

    vi.mocked(fetchInbox).mockResolvedValue(answer([]))
    useDataVersionStore().bump()
    await vi.waitFor(() => expect(store.itemsFor(target)).toEqual([]))
  })
})
