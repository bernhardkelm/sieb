import { describe, expect, it } from 'vitest'
import type { LocationQuery, RouteLocationNormalized } from 'vue-router'

import { leavesFinding } from '@/router/findingNavigation'

/**
 * Builds a normalized location with a path and a query.
 * @param {string} path - Path
 * @param {LocationQuery} query - Query
 * @returns {RouteLocationNormalized} - Location
 */
const at = (path: string, query: LocationQuery = {}): RouteLocationNormalized =>
  ({ path, query }) as unknown as RouteLocationNormalized

describe('leavesFinding', () => {
  it('flags another finding, a closed panel and a view change that drops the finding', () => {
    expect(leavesFinding(at('/inbox', { finding: '2' }), at('/inbox', { finding: '1' }))).toBe(true)
    expect(leavesFinding(at('/inbox'), at('/inbox', { finding: '1' }))).toBe(true)
    expect(leavesFinding(at('/images'), at('/inbox', { finding: '1' }))).toBe(true)
  })

  it('passes navigations that keep the finding, such as filters or a view change with it', () => {
    expect(
      leavesFinding(at('/inbox', { finding: '1', sort: 'cvss' }), at('/inbox', { finding: '1' })),
    ).toBe(false)
    expect(leavesFinding(at('/cves', { finding: '1' }), at('/inbox', { finding: '1' }))).toBe(false)
    expect(leavesFinding(at('/cves'), at('/inbox'))).toBe(false)
  })
})
