import { describe, expect, it } from 'vitest'

import type { CveAggregate } from '#core/cveAggregation.ts'
import { sortCves } from '@/components/cves/cveSort'

/**
 * Builds a CVE aggregate.
 * @param {string} vulnId - Vuln id
 * @param {Partial<CveAggregate>} overrides - Fields to set
 * @returns {CveAggregate} - Aggregate
 */
const cve = (vulnId: string, overrides: Partial<CveAggregate> = {}): CveAggregate => ({
  vulnId,
  title: null,
  primaryLink: null,
  kev: false,
  maxSeverity: 'High',
  maxScore: 7.5,
  maxExposure: 'internal',
  imageCount: 1,
  imageRefs: [],
  openCount: 1,
  inboxCount: 1,
  decisionStates: { undecided: 1, active: 0, fix_planned: 0, expired: 0, reopened: 0, revoked: 0 },
  allScopeDecision: null,
  allScopeEffective: null,
  ...overrides,
})

const CVES = [
  cve('CVE-2024-1000', { kev: true, title: 'openssl' }),
  cve('CVE-2024-999', { maxSeverity: 'Critical', maxScore: null, imageCount: 4 }),
  cve('CVE-2025-1', { maxSeverity: 'Critical', maxScore: 9.8, title: 'curl', inboxCount: 0 }),
]

/**
 * Returns the vuln ids of CVEs in order.
 * @param {readonly CveAggregate[]} cves - CVEs
 * @returns {string[]} - Vuln ids
 */
const ids = (cves: readonly CveAggregate[]): string[] => cves.map((entry) => entry.vulnId)

describe('sortCves', () => {
  it('keeps the API order by default', () => {
    expect(ids(sortCves(CVES, null))).toEqual(['CVE-2024-1000', 'CVE-2024-999', 'CVE-2025-1'])
  })

  it('sorts severity by rank, then score with a missing score lowest', () => {
    expect(ids(sortCves(CVES, { column: 'severity', direction: 'desc' }))).toEqual([
      'CVE-2025-1',
      'CVE-2024-999',
      'CVE-2024-1000',
    ])
  })

  it('sorts ids naturally and titles with missing titles last', () => {
    expect(ids(sortCves(CVES, { column: 'vulnId', direction: 'asc' }))).toEqual([
      'CVE-2024-999',
      'CVE-2024-1000',
      'CVE-2025-1',
    ])
    expect(ids(sortCves(CVES, { column: 'title', direction: 'desc' }))).toEqual([
      'CVE-2024-1000',
      'CVE-2025-1',
      'CVE-2024-999',
    ])
  })

  it('sorts KEV and counts', () => {
    expect(ids(sortCves(CVES, { column: 'kev', direction: 'desc' }))[0]).toBe('CVE-2024-1000')
    expect(ids(sortCves(CVES, { column: 'images', direction: 'desc' }))[0]).toBe('CVE-2024-999')
    expect(ids(sortCves(CVES, { column: 'inbox', direction: 'asc' }))[0]).toBe('CVE-2025-1')
  })
})
