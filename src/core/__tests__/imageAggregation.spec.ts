import { describe, expect, it } from 'vitest'

import { aggregateImages } from '#core/imageAggregation.ts'

import { buildDecision, buildFindingView, NOW } from './coreBuilders.ts'

const NGINX = 'index.docker.io/library/nginx'
const DEMO = 'registry.example.com/acme/demo-app'

describe('aggregateImages', () => {
  it('counts open findings per image by severity, inbox and suppression', () => {
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
      openCount: 2,
      openBySeverity: { Critical: 1, High: 1, Medium: 0, Low: 0, Unknown: 0 },
      fixableCount: 2,
      kevCount: 1,
      inboxCount: 1,
      suppressedCount: 1,
      workloadCount: 2,
      workloads: ['shop/ReplicaSet/web-6d4f', 'shop/ReplicaSet/web-7a1b'],
    })
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
