import { describe, expect, it } from 'vitest'

import { aggregateImages, isOnlyNotAffected, withNotAffected } from '#core/imageAggregation.ts'

import { buildDecision, buildFindingView, NOW } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const DEMO = 'registry.example.com/acme/demo-app'

describe('aggregateImages', () => {
  it('counts open findings per image by severity and inbox, not affected ones apart', () => {
    const [nginx] = aggregateImages([
      buildFindingView({ id: 1, imageRef: NGINX, severity: 'Critical', kev: true }),
      buildFindingView({
        id: 2,
        imageRef: NGINX,
        vulnId: 'CVE-2',
        exposure: 'gated',
        workloads: ['shop/ReplicaSet/web-6d4f', 'shop/ReplicaSet/web-7a1b'],
        decision: buildDecision(),
        effective: { state: 'active' },
        inInbox: false,
      }),
      buildFindingView({
        id: 3,
        imageRef: NGINX,
        vulnId: 'CVE-3',
        severity: 'Low',
        resolvedAt: NOW.toISOString(),
        inInbox: false,
      }),
    ])

    expect(nginx).toEqual({
      imageRef: NGINX,
      owner: 'third-party',
      maxExposure: 'gated',
      maxSeverity: 'Critical',
      openCount: 1,
      openBySeverity: { Critical: 1, High: 0, Medium: 0, Low: 0, Unknown: 0 },
      fixableCount: 1,
      kevCount: 1,
      inboxCount: 1,
      notAffectedCount: 1,
      acceptedCount: 0,
      workloadCount: 2,
      workloads: ['shop/ReplicaSet/web-6d4f', 'shop/ReplicaSet/web-7a1b'],
      includingNotAffected: {
        maxSeverity: 'Critical',
        openCount: 2,
        openBySeverity: { Critical: 1, High: 1, Medium: 0, Low: 0, Unknown: 0 },
        fixableCount: 2,
        kevCount: 1,
      },
    })
  })

  it('keeps accepted findings and decisions not in effect in the risk counts', () => {
    const [image] = aggregateImages([
      buildFindingView({
        id: 1,
        imageRef: NGINX,
        severity: 'Critical',
        kev: true,
        decision: buildDecision({ status: 'accepted' }),
        effective: { state: 'active' },
        inInbox: false,
      }),
      buildFindingView({
        id: 2,
        imageRef: NGINX,
        vulnId: 'CVE-2',
        decision: buildDecision({ id: 2, vulnId: 'CVE-2' }),
        effective: { state: 'expired', expiresAt: '2026-05-20T00:00:00.000Z' },
      }),
      buildFindingView({
        id: 3,
        imageRef: NGINX,
        vulnId: 'CVE-3',
        decision: buildDecision({ id: 3, vulnId: 'CVE-3' }),
        effective: { state: 'revoked', revokedAt: '2026-05-20T00:00:00.000Z' },
      }),
    ])

    expect(image).toMatchObject({
      maxSeverity: 'Critical',
      openCount: 3,
      kevCount: 1,
      notAffectedCount: 0,
      acceptedCount: 1,
    })
    expect(image && isOnlyNotAffected(image)).toBe(false)
  })

  it('marks an image whose open findings are all not affected and restores its counts', () => {
    const [image] = aggregateImages([
      buildFindingView({
        id: 1,
        imageRef: NGINX,
        severity: 'Critical',
        kev: true,
        decision: buildDecision(),
        effective: { state: 'active' },
        inInbox: false,
      }),
    ])

    expect(image).toMatchObject({ openCount: 0, kevCount: 0, notAffectedCount: 1 })
    expect(image?.maxSeverity).toBe('Critical')
    expect(image && isOnlyNotAffected(image)).toBe(true)
    expect(image && withNotAffected(image)).toMatchObject({
      openCount: 1,
      kevCount: 1,
      openBySeverity: { Critical: 1 },
      notAffectedCount: 1,
    })
  })

  it('orders images by their risk counts, not affected findings left out', () => {
    const images = aggregateImages([
      buildFindingView({
        id: 1,
        imageRef: 'a',
        severity: 'Critical',
        decision: buildDecision({ imageRef: 'a' }),
        effective: { state: 'active' },
        inInbox: false,
      }),
      buildFindingView({ id: 2, imageRef: 'a', vulnId: 'CVE-2', severity: 'Low' }),
      buildFindingView({ id: 3, imageRef: 'b', vulnId: 'CVE-3', severity: 'High' }),
    ])

    expect(images.map((image) => [image.imageRef, image.maxSeverity])).toEqual([
      ['b', 'High'],
      ['a', 'Low'],
    ])
  })

  it('sorts own images first, then other owners alphabetically, no owner last, then exposure', () => {
    const images = aggregateImages([
      buildFindingView({ id: 1, imageRef: 'a', owner: 'platform', exposure: 'internal' }),
      buildFindingView({ id: 2, imageRef: 'b', exposure: 'internal' }),
      buildFindingView({ id: 3, imageRef: 'c', exposure: 'public' }),
      buildFindingView({ id: 4, imageRef: DEMO, owner: 'self' }),
      buildFindingView({ id: 5, imageRef: 'd', owner: null, exposure: 'public' }),
      buildFindingView({ id: 6, imageRef: 'e', exposure: null }),
    ])

    expect(images.map((image) => image.imageRef)).toEqual([DEMO, 'a', 'c', 'e', 'b', 'd'])
  })

  it('takes the most exposed workload, unknown above internal, and the first owner', () => {
    const [image] = aggregateImages([
      buildFindingView({ id: 1, imageRef: 'a', owner: 'platform', exposure: 'internal' }),
      buildFindingView({ id: 2, imageRef: 'a', owner: null, exposure: null }),
      buildFindingView({ id: 3, imageRef: 'a', owner: 'ops', exposure: 'internal' }),
    ])

    expect(image).toMatchObject({ owner: 'ops', maxExposure: null })
  })
})
