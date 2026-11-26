import { describe, expect, it } from 'vitest'

import { aggregateCves, isFullyDecided } from '#core/cveAggregation.ts'

import { buildDecision, buildFindingView } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

describe('aggregateCves', () => {
  it('aggregates a CVE across images with its decision states', () => {
    const all = buildDecision({ id: 10, scope: 'all', imageRef: null })
    const [cve] = aggregateCves(
      [
        buildFindingView({ id: 1, imageRef: NGINX, score: 7.5, title: null }),
        buildFindingView({
          id: 2,
          imageRef: REDIS,
          severity: 'Critical',
          score: 9.8,
          exposure: 'public',
          title: 'heap overflow',
          decision: all,
          effective: { state: 'active' },
          inInbox: false,
        }),
      ],
      [all, buildDecision({ id: 11, vulnId: 'CVE-2', scope: 'all', imageRef: null })],
    )

    expect(cve).toEqual({
      vulnId: 'CVE-2025-1000',
      title: 'heap overflow',
      primaryLink: null,
      kev: false,
      maxSeverity: 'Critical',
      maxScore: 9.8,
      maxExposure: 'public',
      imageCount: 2,
      imageRefs: [NGINX, REDIS],
      openCount: 2,
      inboxCount: 1,
      decisionStates: {
        undecided: 1,
        active: 1,
        fix_planned: 0,
        expired: 0,
        reopened: 0,
        revoked: 0,
      },
      allScopeDecision: all,
    })
  })

  it('sorts KEV listed CVEs first, then by exposure and severity', () => {
    const cves = aggregateCves([
      buildFindingView({ id: 1, vulnId: 'CVE-A', severity: 'Critical' }),
      buildFindingView({ id: 2, vulnId: 'CVE-B', kev: true, severity: 'Low', score: null }),
      buildFindingView({ id: 3, vulnId: 'CVE-C', exposure: 'public', severity: 'Low' }),
    ])

    expect(cves.map((cve) => [cve.vulnId, cve.allScopeDecision])).toEqual([
      ['CVE-B', null],
      ['CVE-C', null],
      ['CVE-A', null],
    ])
    expect(cves[0]?.maxScore).toBeNull()
  })
})

describe('isFullyDecided', () => {
  it('holds when every open finding has a decision in effect, fix_planned included', () => {
    const [cve] = aggregateCves([
      buildFindingView({
        id: 1,
        imageRef: NGINX,
        decision: buildDecision(),
        effective: { state: 'active' },
        inInbox: false,
      }),
      buildFindingView({
        id: 2,
        imageRef: REDIS,
        decision: buildDecision({ id: 2, imageRef: REDIS, status: 'fix_planned' }),
        effective: { state: 'fix_planned' },
        inInbox: false,
      }),
      buildFindingView({ id: 3, imageRef: 'c', resolvedAt: '2026-05-30T00:00:00.000Z' }),
    ])

    expect(cve && isFullyDecided(cve)).toBe(true)
  })

  it('does not hold with an undecided, expired, revoked or re-opened finding', () => {
    const decided = buildFindingView({
      id: 1,
      imageRef: NGINX,
      decision: buildDecision(),
      effective: { state: 'active' },
      inInbox: false,
    })
    const others = [
      {},
      { effective: { state: 'expired', expiresAt: '2026-05-20T00:00:00.000Z' } },
      { effective: { state: 'revoked', revokedAt: '2026-05-20T00:00:00.000Z' } },
      {
        effective: {
          state: 'reopened',
          reopenedAt: null,
          reason: 'kev_listed',
          imageRef: REDIS,
          severity: 'High',
          kev: true,
          baselineSeverity: 'High',
          baselineKev: false,
        },
      },
    ] as const

    for (const other of others) {
      const [cve] = aggregateCves([
        decided,
        buildFindingView({ id: 2, imageRef: REDIS, decision: buildDecision({ id: 2 }), ...other }),
      ])

      expect(cve && isFullyDecided(cve)).toBe(false)
    }
  })

  it('does not hold for a CVE without open findings', () => {
    const [cve] = aggregateCves([buildFindingView({ resolvedAt: '2026-05-30T00:00:00.000Z' })])

    expect(cve && isFullyDecided(cve)).toBe(false)
  })
})
