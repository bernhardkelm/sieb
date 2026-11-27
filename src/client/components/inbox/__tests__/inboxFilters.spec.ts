import { describe, expect, it } from 'vitest'

import type { InboxItem } from '#core/inbox/inboxItem.ts'
import { expiringItem, kevItem, proposalItem, reopenedItem } from '@/__tests__/inboxItemBuilders'
import {
  emptyInboxFilters,
  filterInboxItems,
  hasInboxFilters,
  withoutHiddenInboxColumns,
  type InboxFilters,
} from '@/components/inbox/inboxFilters'

const REDIS = 'index.docker.io/library/redis'

const PROPOSAL = proposalItem(1, {
  imageRefs: [REDIS],
  severity: 'Critical',
  exposure: 'public',
  owners: ['self'],
  packages: ['libssl3'],
  namespaces: ['shop'],
})
const REOPENED = reopenedItem(2, { title: 'zlib inflate overflow', owners: ['self', 'k3s'] })
const KEV = kevItem(3, { severity: 'Low', exposure: 'internal', namespaces: ['kube-system'] })
const EXPIRING = expiringItem(4, { imageRef: null })
const ITEMS: InboxItem[] = [PROPOSAL, REOPENED, KEV, EXPIRING]

/**
 * Returns the keys of the items passing filters.
 * @param {Partial<InboxFilters>} patch - Filters to set
 * @returns {string[]} - Item keys in order
 */
const keysOf = (patch: Partial<InboxFilters>): string[] =>
  filterInboxItems(ITEMS, { ...emptyInboxFilters(), ...patch }).map((item) => item.key)

describe('filterInboxItems', () => {
  it('keeps every item in order without filters', () => {
    expect(keysOf({})).toEqual(ITEMS.map((item) => item.key))
  })

  it('searches vuln_id, title, target images, packages and namespaces case-insensitively', () => {
    expect(keysOf({ q: PROPOSAL.vulnId.toLowerCase() })).toEqual([PROPOSAL.key])
    expect(keysOf({ q: 'ZLIB' })).toEqual([REOPENED.key])
    expect(keysOf({ q: 'redis' })).toEqual([PROPOSAL.key])
    expect(keysOf({ q: 'libssl' })).toEqual([PROPOSAL.key])
    expect(keysOf({ q: 'kube-system' })).toEqual([KEV.key])
    expect(keysOf({ q: 'library/nginx' })).toEqual([REOPENED.key, KEV.key])
    expect(keysOf({ q: '  ' })).toHaveLength(ITEMS.length)
  })

  it('narrows by kind, severity and KEV', () => {
    expect(keysOf({ kind: ['kev', 'expiring'] })).toEqual([KEV.key, EXPIRING.key])
    expect(keysOf({ severity: ['Critical', 'Low'] })).toEqual([PROPOSAL.key, REOPENED.key, KEV.key])
    expect(keysOf({ kev: true })).toEqual([KEV.key])
  })

  it('narrows by the most exposed covered finding, unknown selecting items without exposure', () => {
    expect(keysOf({ exposure: ['public'] })).toEqual([PROPOSAL.key])
    expect(keysOf({ exposure: ['unknown'] })).toEqual([REOPENED.key, EXPIRING.key])
  })

  it('keeps an item when any covered finding has a selected owner', () => {
    expect(keysOf({ owner: ['k3s'] })).toEqual([REOPENED.key])
    expect(keysOf({ owner: ['self'] })).toEqual([PROPOSAL.key, REOPENED.key])
  })

  it('combines filters', () => {
    expect(keysOf({ owner: ['self'], kind: ['reopened'], q: 'zlib' })).toEqual([REOPENED.key])
    expect(keysOf({ kev: true, severity: ['Critical'] })).toEqual([])
  })
})

describe('hasInboxFilters', () => {
  it('ignores the filters of hidden label columns', () => {
    const filters = {
      ...emptyInboxFilters(),
      exposure: ['public' as const],
      owner: ['self'],
      kev: true,
    }

    expect(hasInboxFilters(emptyInboxFilters())).toBe(false)
    expect(hasInboxFilters(filters)).toBe(true)
    expect(hasInboxFilters(filters, ['exposure', 'owner', 'kev'])).toBe(false)
    expect(withoutHiddenInboxColumns(filters, ['exposure', 'owner', 'kev'])).toEqual(
      emptyInboxFilters(),
    )
    expect(hasInboxFilters({ ...emptyInboxFilters(), kind: ['proposal'] }, ['kev'])).toBe(true)
  })
})
