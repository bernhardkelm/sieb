import { describe, expect, it } from 'vitest'

import { buildDecision, buildFindingView, NOW } from '#core/__tests__/coreBuilders.ts'
import { aggregateCves } from '#core/cveAggregation.ts'
import { countHiddenCves, filterCves } from '@/components/cves/cveFilters'
import { emptyAggregateFilters, hasAggregateFilters } from '@/components/filters/aggregateFilters'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

const CVES = aggregateCves(
  [
    buildFindingView({ id: 1, vulnId: 'CVE-OPEN', imageRef: NGINX }),
    buildFindingView({
      id: 2,
      vulnId: 'CVE-DONE',
      imageRef: NGINX,
      decision: buildDecision({ id: 2, vulnId: 'CVE-DONE' }),
      effective: { state: 'active' },
      inInbox: false,
    }),
    buildFindingView({
      id: 3,
      vulnId: 'CVE-DONE',
      imageRef: REDIS,
      decision: buildDecision({
        id: 3,
        vulnId: 'CVE-DONE',
        imageRef: REDIS,
        status: 'fix_planned',
      }),
      effective: { state: 'fix_planned' },
      inInbox: false,
    }),
    buildFindingView({
      id: 4,
      vulnId: 'CVE-EXPIRED',
      imageRef: NGINX,
      decision: buildDecision({ id: 4, vulnId: 'CVE-EXPIRED' }),
      effective: { state: 'expired', expiresAt: '2026-05-20T00:00:00.000Z' },
    }),
  ],
  [],
  NOW,
)

/**
 * Returns the vuln ids of CVEs, sorted.
 * @param {readonly { vulnId: string }[]} cves - CVEs
 * @returns {string[]} - Vuln ids
 */
const ids = (cves: readonly { vulnId: string }[]): string[] => cves.map((cve) => cve.vulnId).sort()

describe('filterCves', () => {
  it('hides fully decided CVEs by default, expired decisions stay visible', () => {
    const filters = emptyAggregateFilters()

    expect(hasAggregateFilters(filters)).toBe(false)
    expect(ids(filterCves(CVES, filters))).toEqual(['CVE-EXPIRED', 'CVE-OPEN'])
    expect(countHiddenCves(CVES, filters)).toBe(1)
  })

  it('shows them again with showDecided', () => {
    const filters = { ...emptyAggregateFilters(), showDecided: true }

    expect(hasAggregateFilters(filters)).toBe(true)
    expect(ids(filterCves(CVES, filters))).toEqual(['CVE-DONE', 'CVE-EXPIRED', 'CVE-OPEN'])
    expect(countHiddenCves(CVES, filters)).toBe(0)
  })

  it('counts only hidden CVEs that pass the other filters', () => {
    expect(countHiddenCves(CVES, { ...emptyAggregateFilters(), q: 'CVE-OPEN' })).toBe(0)
  })
})

describe('filterCves exposure', () => {
  it('keeps CVEs without exposure label through unknown', () => {
    const cves = aggregateCves(
      [
        buildFindingView({ id: 1, vulnId: 'CVE-PUBLIC', exposure: 'public' }),
        buildFindingView({ id: 2, vulnId: 'CVE-UNLABELLED', exposure: null }),
      ],
      [],
      NOW,
    )
    /**
     * Returns the vuln ids an exposure filter keeps.
     * @param {('public' | 'unknown')[]} exposure - Selected entries
     * @returns {string[]} - Vuln ids
     */
    const ids = (exposure: ('public' | 'unknown')[]): string[] =>
      filterCves(cves, { ...emptyAggregateFilters(), exposure }).map((cve) => cve.vulnId)

    expect(ids(['unknown'])).toEqual(['CVE-UNLABELLED'])
    expect(ids(['public'])).toEqual(['CVE-PUBLIC'])
  })
})
