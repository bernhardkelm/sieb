import { describe, expect, it } from 'vitest'

import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import {
  concernsFinding,
  inboxItemsForFinding,
  type InboxFindingTarget,
} from '@/components/inbox/findingInboxItems'

const VULN = 'CVE-2099-10001'
const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

const FINDING: InboxFindingTarget = { id: 11, vulnId: VULN, imageRef: NGINX, decision: { id: 5 } }

describe('concernsFinding', () => {
  it('matches a proposal on the image of the finding or on every image', () => {
    expect(concernsFinding(proposalItem(1, { vulnId: VULN, imageRefs: [NGINX] }), FINDING)).toBe(
      true,
    )
    expect(concernsFinding(proposalItem(1, { vulnId: VULN, imageRefs: null }), FINDING)).toBe(true)
    expect(
      concernsFinding(proposalItem(1, { vulnId: VULN, imageRefs: [REDIS, NGINX] }), FINDING),
    ).toBe(true)
    expect(concernsFinding(proposalItem(1, { vulnId: VULN, imageRefs: [REDIS] }), FINDING)).toBe(
      false,
    )
    expect(concernsFinding(proposalItem(1, { imageRefs: null }), FINDING)).toBe(false)
  })

  it('matches re-opened and expiring decisions that govern the finding, also on every image', () => {
    const allImages = { vulnId: VULN, imageRef: null }

    expect(concernsFinding(reopenedItem(5, { vulnId: VULN }), FINDING)).toBe(true)
    expect(concernsFinding(reopenedItem(5, allImages), FINDING)).toBe(true)
    expect(concernsFinding(expiringItem(5, allImages), FINDING)).toBe(true)
    expect(concernsFinding(expiringItem(6, allImages), FINDING)).toBe(false)
    expect(concernsFinding(reopenedItem(5, allImages), { ...FINDING, decision: null })).toBe(false)
  })

  it('matches a new KEV listing of the finding itself only', () => {
    expect(concernsFinding(kevItem(11, { vulnId: VULN }), FINDING)).toBe(true)
    expect(concernsFinding(kevItem(12, { vulnId: VULN }), FINDING)).toBe(false)
  })
})

describe('inboxItemsForFinding', () => {
  it('orders proposals, re-opened decisions, new KEV listings and expiring decisions', () => {
    const items = [
      expiringItem(5, { vulnId: VULN }),
      kevItem(11, { vulnId: VULN }),
      reopenedItem(5, { vulnId: VULN, imageRef: null }),
      proposalItem(2, { vulnId: VULN, imageRefs: null }),
      proposalItem(3, { vulnId: VULN, imageRefs: [NGINX] }),
      kevItem(12, { vulnId: VULN }),
    ]

    expect(inboxItemsForFinding(items, FINDING).map((item) => item.key)).toEqual([
      'proposal:2',
      'proposal:3',
      'reopened:5:pending',
      'kev:11',
      items[0]!.key,
    ])
  })
})
