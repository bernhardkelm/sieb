import { describe, expect, it } from 'vitest'

import { readQueryParam, withQueryParam, withQueryParams } from '@/router/queryParam'

describe('queryParam', () => {
  it('reads single non-empty values only', () => {
    expect(readQueryParam({ image: 'nginx' }, 'image')).toBe('nginx')
    expect(readQueryParam({ image: '' }, 'image')).toBeNull()
    expect(readQueryParam({ image: ['a', 'b'] }, 'image')).toBeNull()
    expect(readQueryParam({}, 'image')).toBeNull()
  })

  it('sets a param and keeps the others, such as the open finding', () => {
    expect(withQueryParam({ finding: '12' }, 'cve', 'CVE-2025-1')).toEqual({
      finding: '12',
      cve: 'CVE-2025-1',
    })
  })

  it('removes a param for null without touching the input', () => {
    const query = { finding: '12', cve: 'CVE-2025-1' }

    expect(withQueryParam(query, 'cve', null)).toEqual({ finding: '12' })
    expect(query).toEqual({ finding: '12', cve: 'CVE-2025-1' })
  })

  it('sets and removes several params in one go', () => {
    expect(
      withQueryParams({ finding: '12', sort: 'kev', dir: 'asc' }, { sort: 'title', dir: null }),
    ).toEqual({ finding: '12', sort: 'title' })
  })
})
