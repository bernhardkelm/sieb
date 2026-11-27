import { describe, expect, it } from 'vitest'

import { buildBaseline, buildDecision } from '#core/__tests__/coreBuilders.ts'
import {
  concernsFinding,
  inboxItemsForFinding,
  type InboxFindingTarget,
} from '#core/inbox/findingInboxItems.ts'
import type { InboxItem } from '#core/inbox/inboxItem.ts'

import {
  DAY_MS,
  fromNow,
  inboxFinding,
  inboxOf,
  inboxProposal,
  NGINX,
  REDIS,
} from './inboxBuilders.ts'

const VULN = 'CVE-2025-1000'
const FINDING: InboxFindingTarget = { id: 11, vulnId: VULN, imageRef: NGINX, decision: { id: 5 } }

/**
 * Returns the Inbox item of a key from the fixture Inbox: proposals 1 to 4 on nginx, every
 * image, nginx and redis, redis; decision 5 on every image re-opened, decision 6 on redis
 * expiring; finding 11 newly KEV listed; proposal 7 on another vulnerability.
 * @param {string} key - Item key
 * @returns {InboxItem} - Item
 */
const item = (key: string): InboxItem => {
  const { items } = inboxOf({
    findings: [
      inboxFinding({
        id: 11,
        imageRef: NGINX,
        severity: 'Critical',
        kev: true,
        kevSince: fromNow(-DAY_MS),
      }),
      inboxFinding({ id: 12, imageRef: REDIS, kev: true, kevSince: fromNow(-DAY_MS) }),
    ],
    decisions: [
      buildDecision({
        id: 5,
        scope: 'all',
        imageRef: null,
        baselines: [buildBaseline({ imageRef: NGINX }), buildBaseline({ imageRef: REDIS })],
      }),
      buildDecision({
        id: 6,
        imageRef: REDIS,
        status: 'accepted',
        kevAtDecision: true,
        expiresAt: fromNow(DAY_MS),
      }),
    ],
    proposals: [
      inboxProposal({ id: 1, imageRefs: [NGINX] }),
      inboxProposal({ id: 2, imageRefs: null }),
      inboxProposal({ id: 3, imageRefs: [REDIS, NGINX] }),
      inboxProposal({ id: 4, imageRefs: [REDIS] }),
      inboxProposal({ id: 7, vulnId: 'CVE-2025-2000', imageRefs: null }),
    ],
  })
  const found = items.find((candidate) => candidate.key.startsWith(key))

  if (!found) {
    throw new Error(`no item ${key}`)
  }

  return found
}

describe('concernsFinding', () => {
  it('matches a proposal on the image of the finding or on every image', () => {
    expect(concernsFinding(item('proposal:1'), FINDING)).toBe(true)
    expect(concernsFinding(item('proposal:2'), FINDING)).toBe(true)
    expect(concernsFinding(item('proposal:3'), FINDING)).toBe(true)
    expect(concernsFinding(item('proposal:4'), FINDING)).toBe(false)
    expect(concernsFinding(item('proposal:7'), FINDING)).toBe(false)
  })

  it('matches re-opened and expiring decisions that govern the finding, also on every image', () => {
    expect(concernsFinding(item('reopened:5'), FINDING)).toBe(true)
    expect(concernsFinding(item('expiring:6'), FINDING)).toBe(false)
    expect(concernsFinding(item('expiring:6'), { ...FINDING, decision: { id: 6 } })).toBe(true)
    expect(concernsFinding(item('reopened:5'), { ...FINDING, decision: null })).toBe(false)
  })

  it('matches a new KEV listing of the finding itself only', () => {
    expect(concernsFinding(item('kev:11'), FINDING)).toBe(true)
    expect(concernsFinding(item('kev:12'), FINDING)).toBe(false)
  })
})

describe('inboxItemsForFinding', () => {
  it('orders proposals, re-opened decisions, new KEV listings and expiring decisions', () => {
    const items = ['expiring:6', 'kev:11', 'reopened:5', 'proposal:2', 'proposal:1'].map(item)

    expect(
      inboxItemsForFinding(items, { ...FINDING, decision: { id: 6 } }).map((entry) => entry.key),
    ).toEqual(['proposal:2', 'proposal:1', 'kev:11', items[0]!.key])
    expect(inboxItemsForFinding(items, FINDING).map((entry) => entry.kind)).toEqual([
      'proposal',
      'proposal',
      'reopened',
      'kev',
    ])
  })
})
