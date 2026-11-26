import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { buildDecision, buildFindingView } from '#core/__tests__/coreBuilders.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'
import {
  daysFromNow,
  expiringItem,
  kevItem,
  proposalItem,
  reopenedItem,
} from '@/__tests__/inboxItemBuilders'
import { mountOnTriage } from '@/__tests__/mountOnTriage'
import FindingInboxLine from '@/components/inbox/FindingInboxLine.vue'

const VULN = 'CVE-2025-1000'
const FINDING = buildFindingView({ id: 1, decision: buildDecision({ id: 9 }) })

let wrapper: VueWrapper | null = null

/**
 * Mounts the Inbox line of the finding with the Inbox holding items.
 * @param {InboxItem[]} items - Inbox items
 * @returns {Promise<void>} - Resolves once rendered
 */
const mountLine = async (items: InboxItem[]): Promise<void> => {
  const line = defineComponent({ setup: () => () => h(FindingInboxLine, { finding: FINDING }) })

  wrapper = (await mountOnTriage(line, items)).wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('FindingInboxLine', () => {
  it('links every Inbox item of the finding except proposals, which have their own notice', async () => {
    const expiring = expiringItem(9, { vulnId: VULN, imageRef: null, at: daysFromNow(5) })

    await mountLine([
      proposalItem(4, { vulnId: VULN, imageRefs: null }),
      expiring,
      kevItem(1, { vulnId: VULN, at: daysFromNow(-3) }),
      reopenedItem(9, { vulnId: VULN }),
      kevItem(2, { vulnId: VULN }),
    ])

    const links = [...document.querySelectorAll<HTMLAnchorElement>('.finding-inbox a')]

    expect(document.querySelector('.finding-inbox .label')?.textContent).toBe('In your Inbox')
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Decision re-opened: Severity rose',
      'KEV listed 3 days ago',
      'Decision expires in 5 days',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/inbox?item=reopened:9:pending',
      '/inbox?item=kev:1',
      `/inbox?item=${expiring.key}`,
    ])
    expect(links.every((link) => link.getAttribute('tabindex') === null)).toBe(true)
  })

  it('stays hidden with only a proposal or nothing waiting', async () => {
    await mountLine([proposalItem(4, { vulnId: VULN, imageRefs: null })])

    expect(document.querySelector('.finding-inbox')).toBeNull()
  })
})
