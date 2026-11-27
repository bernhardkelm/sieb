import { describe, expect, it } from 'vitest'

import { emptyInboxFilters, type InboxFilters } from '@/components/inbox/inboxFilters'
import { inboxFilterParams, readInboxFilters, sameInboxFilters } from '@/router/inboxFilterQuery'

const FILTERS: InboxFilters = {
  q: 'libssl',
  kind: ['proposal', 'kev'],
  severity: ['Critical', 'High'],
  exposure: ['public', 'unknown'],
  owner: ['self'],
  kev: true,
}

describe('inbox filter query', () => {
  it('writes the Triage params plus kind and reads them back', () => {
    const params = inboxFilterParams(FILTERS)

    expect(params).toEqual({
      q: 'libssl',
      sev: 'critical,high',
      exp: 'public,unknown',
      owner: 'self',
      kev: '1',
      kind: 'proposal,kev',
    })
    expect(readInboxFilters(params as Record<string, string>)).toEqual(FILTERS)
  })

  it('removes every param of an unset filter', () => {
    expect(Object.values(inboxFilterParams(emptyInboxFilters()))).toEqual(
      Array.from({ length: 6 }, () => null),
    )
  })

  it('ignores invalid entries and the Triage-only params', () => {
    expect(
      readInboxFilters({
        kind: 'Proposal,bogus,proposal',
        sev: 'severe',
        kev: 'yes',
        new: '1',
        resolved: '1',
        pending: 'proposal',
        upstream: '1',
      }),
    ).toEqual({ ...emptyInboxFilters(), kind: ['proposal'] })
  })

  it('compares filter states by their params', () => {
    expect(sameInboxFilters(FILTERS, { ...FILTERS, kind: ['proposal', 'kev'] })).toBe(true)
    expect(sameInboxFilters(FILTERS, { ...FILTERS, kev: false })).toBe(false)
  })
})
