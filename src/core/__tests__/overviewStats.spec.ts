import { describe, expect, it } from 'vitest'

import { computeOverviewStats, emptyOverviewStats } from '#core/overviewStats.ts'

import { buildBaseline, buildDecision, buildFinding, NOW } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const REDIS = 'index.docker.io/library/redis'

describe('computeOverviewStats', () => {
  it('counts open findings by inbox, KEV, exposure, severity and verdict', () => {
    const findings = [
      buildFinding({ id: 1, imageRef: NGINX, severity: 'Critical', kev: true, exposure: 'public' }),
      buildFinding({ id: 2, imageRef: REDIS, vulnId: 'CVE-2', exposure: 'gated' }),
      buildFinding({ id: 3, imageRef: REDIS, vulnId: 'CVE-3', severity: 'Low' }),
      buildFinding({ id: 4, imageRef: NGINX, vulnId: 'CVE-4', severity: 'Unknown' }),
      buildFinding({
        id: 5,
        imageRef: 'index.docker.io/library/gone',
        vulnId: 'CVE-5',
        kev: true,
        resolvedAt: NOW.toISOString(),
      }),
    ]
    const decisions = [
      buildDecision({ id: 10, vulnId: 'CVE-2', imageRef: REDIS }),
      buildDecision({ id: 11, vulnId: 'CVE-3', imageRef: REDIS, status: 'fix_planned' }),
      buildDecision({ id: 12, vulnId: 'CVE-5', imageRef: 'index.docker.io/library/gone' }),
      buildDecision({ id: 13, vulnId: 'CVE-4', imageRef: NGINX, status: 'accepted' }),
    ]

    expect(computeOverviewStats(findings, decisions, NOW)).toEqual({
      open: 4,
      inbox: 1,
      kev: 1,
      public: 1,
      bySeverity: { critical: 1, high: 1, medium: 0, low: 1, unknown: 1 },
      notAffected: 1,
      accepted: 1,
      fixPlanned: 1,
      reopened: 0,
      activeDecisions: 3,
      images: 2,
    })
  })

  it('counts decisions per state and sends re-opened, expired and revoked ones to the inbox', () => {
    const findings = [
      buildFinding({ id: 1, vulnId: 'CVE-1', severity: 'Critical' }),
      buildFinding({ id: 2, vulnId: 'CVE-2' }),
      buildFinding({ id: 3, vulnId: 'CVE-3' }),
    ]
    const decisions = [
      buildDecision({ id: 10, vulnId: 'CVE-1', baselines: [buildBaseline({ severity: 'High' })] }),
      buildDecision({ id: 11, vulnId: 'CVE-2', expiresAt: '2026-05-01T00:00:00.000Z' }),
      buildDecision({
        id: 12,
        vulnId: 'CVE-3',
        revokedAt: '2026-05-02T00:00:00.000Z',
        revokedBy: 'dev',
      }),
    ]
    const stats = computeOverviewStats(findings, decisions, NOW)

    expect(stats).toMatchObject({
      open: 3,
      inbox: 3,
      notAffected: 0,
      accepted: 0,
      activeDecisions: 0,
    })
    expect(stats.reopened).toBe(1)
  })

  it('answers zero counts without findings', () => {
    expect(computeOverviewStats([], [], NOW)).toEqual(emptyOverviewStats())
  })
})
