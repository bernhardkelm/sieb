import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import { mountOnTriage } from '@/__tests__/mountOnTriage'
import FindingRow from '@/components/finding/FindingRow.vue'
import { INBOX_ITEM_QUERY, ROUTE_NAMES } from '@/router/routeNames'

const VULN = 'CVE-2025-1000'
const FINDING = buildFindingView({ id: 1, decision: buildDecision({ id: 9 }) })

let wrapper: VueWrapper | null = null

/**
 * Mounts one Triage row with the Inbox holding items.
 * @param {InboxItem[]} items - Inbox items
 * @param {() => void} onSelect - Listener of the row select event
 * @returns {ReturnType<typeof mountOnTriage>} - Wrapper and router
 */
const mountRow = async (items: InboxItem[], onSelect: () => void = () => {}) => {
  const row = defineComponent({
    setup: () => () =>
      h(FindingRow, { finding: FINDING, current: false, checked: false, isNew: false, onSelect }),
  })
  const mounted = await mountOnTriage(row, items)

  wrapper = mounted.wrapper
  return mounted
}

/**
 * Returns the marker link in the title column.
 * @returns {HTMLAnchorElement | null} - Link, null without a marker
 */
const marker = (): HTMLAnchorElement | null =>
  document.querySelector<HTMLAnchorElement>('.title .marker-chip')

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('InboxMarker on a finding row', () => {
  it('shows nothing while no Inbox item concerns the finding', async () => {
    await mountRow([kevItem(2, { vulnId: VULN }), proposalItem(3)])

    expect(marker()).toBeNull()
  })

  it('shows the most relevant item: proposal, re-opened, new KEV, expiring', async () => {
    const proposal = proposalItem(4, { vulnId: VULN, imageRefs: null, verdict: 'needs_patch' })
    const reopened = reopenedItem(9, { vulnId: VULN, imageRef: null })
    const kev = kevItem(1, { vulnId: VULN })
    const expiring = expiringItem(9, { vulnId: VULN })
    const expected: [InboxItem[], string][] = [
      [[expiring, kev, reopened, proposal], 'Proposed · Needs patch'],
      [[expiring, kev, reopened], 'Re-opened'],
      [[expiring, kev], 'New KEV'],
      [[expiring], 'Expires soon'],
    ]

    for (const [items, label] of expected) {
      await mountRow(items)
      expect(marker()?.textContent?.trim()).toBe(label)
      wrapper?.unmount()
      document.body.innerHTML = ''
    }
  })

  it('links a proposal to its review and the other kinds to the Inbox item, outside the Tab order', async () => {
    await mountRow([proposalItem(4, { vulnId: VULN, imageRefs: [FINDING.imageRef] })])

    expect(marker()?.getAttribute('href')).toBe('/inbox/proposals/4')
    expect(marker()?.getAttribute('tabindex')).toBe('-1')
    wrapper?.unmount()

    const kev = kevItem(1, { vulnId: VULN })

    await mountRow([kev])
    expect(marker()?.getAttribute('href')).toBe(`/inbox?${INBOX_ITEM_QUERY}=kev:1`)
  })

  it('navigates on a click without selecting the row', async () => {
    const onSelect = vi.fn<() => void>()
    const { router } = await mountRow([reopenedItem(9, { vulnId: VULN })], onSelect)

    document.querySelector<HTMLElement>('[data-finding-id="1"]')!.click()
    expect(onSelect).toHaveBeenCalledOnce()

    marker()!.click()
    await flushPromises()

    expect(onSelect).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.INBOX)
    expect(router.currentRoute.value.query[INBOX_ITEM_QUERY]).toBe('reopened:9:pending')
  })
})
