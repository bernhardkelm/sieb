import { describe, expect, it } from 'vitest'

import {
  findingFilterParams,
  findingFilterQuery,
  readFindingFilters,
  sameFindingFilters,
} from '@/router/findingFilterQuery'
import { emptyFilters } from '@/stores/findingFilters'

describe('readFindingFilters', () => {
  it('reads the compact params', () => {
    expect(
      readFindingFilters({
        q: 'openssl',
        sev: 'critical,High',
        exp: 'public,unknown',
        owner: 'self,platform team',
        kev: '1',
        new: '1',
        resolved: '1',
        pending: 'Proposed,reopened,kev,checking,untouched',
        upstream: '1',
        finding: '12',
      }),
    ).toEqual({
      q: 'openssl',
      severity: ['Critical', 'High'],
      exposure: ['public', 'unknown'],
      owner: ['self', 'platform team'],
      kev: true,
      newThisWeek: true,
      includeResolved: true,
      pending: ['proposed', 'reopened', 'kev', 'checking', 'untouched'],
      upstreamPending: true,
    })
  })

  it('ignores unknown and invalid values', () => {
    expect(
      readFindingFilters({
        sev: 'critical,severe,,critical',
        exp: 'external',
        owner: `self,${'x'.repeat(65)}`,
        kev: 'yes',
        new: ['1', '1'],
        pending: 'later,kev,,kev,expiring',
      }),
    ).toEqual({ ...emptyFilters(), severity: ['Critical'], owner: ['self'], pending: ['kev'] })
    expect(readFindingFilters({})).toEqual(emptyFilters())
  })
})

describe('findingFilterParams', () => {
  it('writes set filters and removes the others, reading back the same filters', () => {
    const filters = {
      ...emptyFilters(),
      q: 'libssl',
      severity: ['Critical' as const, 'High' as const],
      kev: true,
      pending: ['reopened' as const, 'untouched' as const],
      upstreamPending: true,
    }
    const params = findingFilterParams(filters)

    expect(params).toEqual({
      q: 'libssl',
      sev: 'critical,high',
      exp: null,
      owner: null,
      kev: '1',
      new: null,
      resolved: null,
      pending: 'reopened,untouched',
      upstream: '1',
    })
    expect(sameFindingFilters(readFindingFilters(findingFilterQuery(filters)), filters)).toBe(true)
  })

  it('builds link queries with only the set filters', () => {
    expect(findingFilterQuery({ kev: true })).toEqual({ kev: '1' })
    expect(findingFilterQuery({ severity: ['Critical', 'High'] })).toEqual({
      sev: 'critical,high',
    })
    expect(findingFilterQuery({})).toEqual({})
  })
})
